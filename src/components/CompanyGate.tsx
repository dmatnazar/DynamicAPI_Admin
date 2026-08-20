import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Building2,
  Check,
  Database,
  Users,
  KeyRound,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  RefreshCw,
  Server,
  ShieldCheck,
  UserPlus,
  Plus,
  Trash2,
  Link2,
  ExternalLink,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useTenantStore } from '../store/useTenantStore';
import { useAuthStore } from '../store/useAuthStore';
import { useDeviceStore } from '../store/useDeviceStore';
import { useStaffStore } from '../store/useStaffStore';
import { ConnectionFormModal } from '../components/TenantManager/ConnectionFormModal';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import uuid from '../lib/uuid';
import type { TenantConfig, TenantConnection } from '../types/endpoint.types';

interface Props {
  user: {
    id: string;
    username: string;
    fullName: string;
    role: string;
    companyId?: string;
    companySlug?: string;
    companyName?: string;
  };
  deviceCompanyId?: string | null;
  isNewCompany?: boolean;
}

type OnboardingStep = 'company' | 'connection' | 'staff' | 'login';
type TestState = 'idle' | 'testing' | 'success' | 'failed';

interface StaffDraft {
  id: string;
  fullName: string;
  username: string;
  password: string;
}

const STEPS = [
  { id: 'company', label: 'Kompaniýa', icon: Building2, description: 'Esasy maglumatlar' },
  { id: 'connection', label: 'Database', icon: Database, description: 'Baglanyşyk' },
  { id: 'staff', label: 'Işgär', icon: Users, description: 'Ulanyjy döretmek' },
  { id: 'login', label: 'Giriş', icon: KeyRound, description: 'Login we parol' },
] as const;

const inputCls =
  'w-full bg-surface-card border border-surface-border rounded-xl px-3 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-primary-500 transition-colors';
const labelCls = 'block text-xs font-medium text-neutral-300 mb-1.5';

export function CompanyGate({ user, deviceCompanyId, isNewCompany }: Props) {
  const { tenants, activeTenantId, setActiveTenant, createCompanyBasic, addConnection, hydrated } = useTenantStore();
  const { addStaff } = useStaffStore();
  const { profile, checkStatus } = useDeviceStore();

  // ══════════════════════════════════════════════════════════════
  // PREFILL FROM BI — device profile contains company info from BI
  // ══════════════════════════════════════════════════════════════
  const prefillCompany = useMemo(() => {
    if (!profile) return null;
    const slugs = profile.companySlugs || profile.tenantSlugs || [];
    const firstSlug = slugs[0];
    if (!firstSlug) return null;
    return {
      name: profile.companyName || profile.companyNames?.[0] || firstSlug,
      slug: firstSlug,
    };
  }, [profile]);

  // ── Step state ──────────────────────────────────────────────────
  const [step, setStep] = useState<OnboardingStep>('company');
  const [creatingCompanyId, setCreatingCompanyId] = useState<string | null>(null);

  // ── Company step state ─────────────────────────────────────────
  const [companyForm, setCompanyForm] = useState({
    name: prefillCompany?.name || '',
    slug: prefillCompany?.slug || '',
    legalName: '',
    taxId: '',
    industry: '',
    country: 'Türkmenistan',
    city: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    contactPerson: '',
    contactPhone: '',
    contactEmail: '',
    notes: '',
  });
  const [companySaving, setCompanySaving] = useState(false);

  // ── Connection step state ─────────────────────────────────────
  const [connForm, setConnForm] = useState({
    label: 'Primary',
    host: '',
    port: 1433,
    database: '',
    username: '',
    password: '',
    encrypt: true,
    trustServerCertificate: true,
  });
  const [testState, setTestState] = useState<TestState>('idle');
  const [testMsg, setTestMsg] = useState('');
  const [databases, setDatabases] = useState<string[]>([]);
  const [loadingDbs, setLoadingDbs] = useState(false);
  const [showConnPassword, setShowConnPassword] = useState(false);

  // ── Staff step state ──────────────────────────────────────────
  const [staffDrafts, setStaffDrafts] = useState<StaffDraft[]>([
    { id: uuid.uuid(), fullName: '', username: '', password: '' },
  ]);
  const [staffSaving, setStaffSaving] = useState(false);

  // ── Login step state ──────────────────────────────────────────
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // ── Onboarding "saved" company (after company created) ───────
  const [savedCompany, setSavedCompany] = useState<TenantConfig | null>(null);

  // ══════════════════════════════════════════════════════════════
  // AUTO-ADVANCE: When BI approves with a new company → go directly
  // to company onboarding (no select screen!)
  // ══════════════════════════════════════════════════════════════
  const [autoStarted, setAutoStarted] = useState(false);
  useEffect(() => {
    if (isNewCompany && prefillCompany && !autoStarted) {
      setAutoStarted(true);
      setCompanyForm((f) => ({
        ...f,
        name: prefillCompany!.name,
        slug: prefillCompany!.slug,
      }));
      setStep('company');
    }
  }, [isNewCompany, prefillCompany, autoStarted]);

  // Fill form when prefill arrives
  useEffect(() => {
    if (prefillCompany) {
      setCompanyForm((f) => ({
        ...f,
        name: f.name || prefillCompany!.name,
        slug: f.slug || prefillCompany!.slug,
      }));
    }
  }, [prefillCompany]);

  // Reset connection form when entering connection step - if we have a company
  useEffect(() => {
    if (step === 'connection') {
      setTestState('idle');
      setTestMsg('');
    }
  }, [step]);

  // ══════════════════════════════════════════════════════════════
  // STEP 1: COMPANY
  // ══════════════════════════════════════════════════════════════
  const handleCompanySubmit = async () => {
    if (!companyForm.name.trim() || !companyForm.slug.trim()) return;
    setCompanySaving(true);
    try {
      // Create the company in local DB (name + slug pre-filled from BI)
      const company = await createCompanyBasic({
        name: companyForm.name.trim(),
        slug: companyForm.slug.trim(),
        isActive: true,
        legalName: companyForm.legalName,
        taxId: companyForm.taxId,
        industry: companyForm.industry,
        country: companyForm.country,
        city: companyForm.city,
        address: companyForm.address,
        phone: companyForm.phone,
        email: companyForm.email,
        website: companyForm.website,
        contactPerson: companyForm.contactPerson,
        contactPhone: companyForm.contactPhone,
        contactEmail: companyForm.contactEmail,
        notes: companyForm.notes,
      });
      setSavedCompany(company);
      setCreatingCompanyId(company.id);
      setActiveTenant(company.id);
      setStep('connection');
    } finally {
      setCompanySaving(false);
    }
  };

  // ══════════════════════════════════════════════════════════════
  // STEP 2: DATABASE CONNECTION (with test + DB check)
  // ══════════════════════════════════════════════════════════════
  const canTestServer = connForm.host.trim() && connForm.username.trim();

  const runTest = useCallback(async (withDb: boolean) => {
    setTestState('testing');
    setTestMsg('');
    try {
      if (!window.mssqlAPI) {
        setTestState('failed');
        setTestMsg('mssqlAPI elýeterli däl');
        return;
      }
      const res = await window.mssqlAPI.testConnection({
        host: connForm.host,
        port: connForm.port,
        database: withDb ? connForm.database || 'master' : 'master',
        username: connForm.username,
        password: connForm.password,
        encrypt: connForm.encrypt,
        trustServerCertificate: connForm.trustServerCertificate,
      });
      if (res.ok) {
        setTestState('success');
        setTestMsg(res.serverVersion || 'Baglanyşyk üstünlikli');
      } else {
        setTestState('failed');
        setTestMsg(res.message || 'Baglanyp bolmady');
      }
    } catch (e: any) {
      setTestState('failed');
      setTestMsg(e?.message || 'Baglanyşyk ýalňyşlygy');
    }
  }, [connForm]);

  const loadDatabases = useCallback(async () => {
    setLoadingDbs(true);
    setTestMsg('');
    try {
      if (!window.mssqlAPI) {
        setTestMsg('mssqlAPI elýeterli däl');
        setTestState('failed');
        return;
      }
      const res = await window.mssqlAPI.listDatabases({
        host: connForm.host,
        port: connForm.port,
        database: 'master',
        username: connForm.username,
        password: connForm.password,
        encrypt: connForm.encrypt,
        trustServerCertificate: connForm.trustServerCertificate,
      });
      if (res.ok) {
        setDatabases(res.databases || []);
        setTestState('success');
        setTestMsg(res.databases.length ? `${res.databases.length} sany database tapyldy` : 'Database tapylmady');
      } else {
        setDatabases([]);
        setTestState('failed');
        setTestMsg(res.message || 'Serwere birigip bolmady');
      }
    } catch (e: any) {
      setDatabases([]);
      setTestState('failed');
      setTestMsg(e?.message || 'Serwere birigip bolmady');
    } finally {
      setLoadingDbs(false);
    }
  }, [connForm]);

  const handleConnectionNext = async () => {
    if (!connForm.host.trim() || !connForm.username.trim() || !connForm.database.trim() || !savedCompany) return;

    // Final DB test before moving on
    setTestState('testing');
    setTestMsg('');
    try {
      const res = await window.mssqlAPI?.testConnection({
        host: connForm.host,
        port: connForm.port,
        database: connForm.database,
        username: connForm.username,
        password: connForm.password,
        encrypt: connForm.encrypt,
        trustServerCertificate: connForm.trustServerCertificate,
      });
      if (!res?.ok) {
        setTestState('failed');
        setTestMsg(res?.message || 'Database barlagy şowsuz');
        return;
      }
    } catch (e: any) {
      setTestState('failed');
      setTestMsg(e?.message || 'Database barlagy şowsuz');
      return;
    }

    const conn: TenantConnection = {
      id: uuid.uuid(),
      label: connForm.label.trim() || 'Primary',
      dbType: 'mssql',
      host: connForm.host.trim(),
      port: connForm.port || 1433,
      database: connForm.database.trim(),
      username: connForm.username.trim(),
      password: connForm.password,
      encrypt: connForm.encrypt,
      trustServerCertificate: connForm.trustServerCertificate,
      isPrimary: true,
      connectionStatus: 'success',
    };
    addConnection(savedCompany.id, conn);
    setStep('staff');
  };

  // ══════════════════════════════════════════════════════════════
  // STEP 3: STAFF — only viewer role!
  // ══════════════════════════════════════════════════════════════
  const updateStaffDraft = (id: string, patch: Partial<StaffDraft>) => {
    setStaffDrafts((drafts) => drafts.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };

  const addStaffDraft = () => {
    if (staffDrafts.length >= 10) return;
    setStaffDrafts((drafts) => [...drafts, { id: uuid.uuid(), fullName: '', username: '', password: '' }]);
  };

  const removeStaffDraft = (id: string) => {
    setStaffDrafts((drafts) => drafts.filter((d) => d.id !== id));
  };

  const generatePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
    return Array.from({ length: 12 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
  };

  const handleStaffSubmit = async () => {
    if (!savedCompany || staffDrafts.length === 0) return;
    const valid = staffDrafts.filter((d) => d.fullName.trim() && d.username.trim() && d.password);
    if (valid.length === 0) return;

    setStaffSaving(true);
    try {
      for (const draft of valid) {
        const passwordHash = await window.staffAPI.hashPassword(draft.password);
        const passwordEnc = await window.staffAPI.encryptSecret(draft.password);
        addStaff({
          id: draft.id,
          fullName: draft.fullName.trim(),
          username: draft.username.trim(),
          passwordHash,
          passwordEnc,
          role: 'viewer', // ⚠️ Diňe viewer — talap!
          tenantIds: [savedCompany.id],
          active: true,
          createdAt: new Date().toISOString(),
        });
      }
      setStep('login');
    } finally {
      setStaffSaving(false);
    }
  };

  // ══════════════════════════════════════════════════════════════
  // STEP 4: LOGIN
  // ══════════════════════════════════════════════════════════════
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginForm.username.trim() || !loginForm.password) return;
    setLoginLoading(true);
    setLoginError(null);
    try {
      if ((window as any).authAPI?.loginStaff) {
        const res = await (window as any).authAPI.loginStaff({
          username: loginForm.username.trim(),
          password: loginForm.password,
          companyId: savedCompany?.id,
        });
        if (res.ok && res.user) {
          useAuthStore.getState().login(res.user);
          return;
        } else {
          setLoginError(res.error || 'Ulanyjy ady ýa-da parol nädogry');
        }
      } else {
        useAuthStore.getState().login({
          id: 'dev-admin',
          username: loginForm.username.trim(),
          fullName: 'Developer Admin',
          role: 'admin',
        });
      }
    } catch (err: any) {
      setLoginError(err?.message || 'Giriş ýalňyşlygy');
    } finally {
      setLoginLoading(false);
    }
  };

  // ══════════════════════════════════════════════════════════════
  // PROGRESS
  // ══════════════════════════════════════════════════════════════
  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  const goBack = () => {
    if (step === 'connection') setStep('company');
    else if (step === 'staff') setStep('connection');
    else if (step === 'login') setStep('staff');
  };

  // ══════════════════════════════════════════════════════════════
  // RENDER — Always show the wizard (no company selection screen!)
  // ══════════════════════════════════════════════════════════════
  return (
    <div className="h-screen w-screen bg-[#0A0B0F] flex items-center justify-center p-4 sm:p-6 select-none">
      <div className="w-full max-w-2xl bg-surface-raised border border-surface-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Progress Bar */}
        <div className="h-1.5 bg-surface-border">
          <div className="h-full bg-gradient-to-r from-primary-500 to-indigo-500 transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
        </div>

        {/* Step Indicators */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-surface-border/60 bg-surface-card/30">
          {STEPS.map((s, idx) => {
            const isActive = s.id === step;
            const isCompleted = idx < stepIndex;
            const Icon = s.icon;
            return (
              <div key={s.id} className="flex flex-col items-center gap-1.5 flex-1">
                <div
                  className={`h-10 w-10 rounded-xl flex items-center justify-center border transition-all ${
                    isActive
                      ? 'bg-primary-500/20 border-primary-500/50 text-primary-300 shadow-lg shadow-primary-900/30'
                      : isCompleted
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                        : 'bg-surface-card border-surface-border text-neutral-600'
                  }`}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>
                <div className="text-center">
                  <p className={`text-[11px] font-medium ${isActive ? 'text-primary-300' : isCompleted ? 'text-emerald-400' : 'text-neutral-500'}`}>
                    {s.label}
                  </p>
                  <p className="text-[9px] text-neutral-600 hidden sm:block">{s.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Content */}
        <div className="p-5 sm:p-7">
          {/* ─────────── STEP 1: COMPANY ─────────── */}
          {step === 'company' && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="text-center space-y-1.5">
                <div className="mx-auto h-12 w-12 rounded-xl bg-primary-500/20 border border-primary-500/30 flex items-center justify-center text-primary-400 mb-2">
                  <Building2 className="h-6 w-6" />
                </div>
                <h2 className="text-lg font-semibold text-white">Kompaniýa maglumatlary</h2>
                <p className="text-xs text-neutral-400">
                  BI-dan alnan maglumatlar tassyklanýar. Slug we ady üýtgedip bilersiňiz.
                </p>
                {prefillCompany && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/40 border border-emerald-800/40 text-[11px] text-emerald-300 mt-2">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    BI-dan: <span className="font-medium">{prefillCompany.name}</span>
                    <span className="font-mono text-emerald-400/70">({prefillCompany.slug})</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={labelCls}>Kompaniýa ady *</label>
                  <input
                    className={inputCls}
                    value={companyForm.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      setCompanyForm((f) => ({
                        ...f,
                        name,
                        slug: name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
                      }));
                    }}
                    placeholder="Mysal: Acme LLC"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={labelCls}>Slug (URL) *</label>
                  <input
                    className={`${inputCls} font-mono`}
                    value={companyForm.slug}
                    onChange={(e) => setCompanyForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
                    placeholder="acme-llc"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-surface-border/60 bg-surface-card/30 p-4 space-y-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  Goşmaça maglumatlar (islege görä)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Kanuny ady</label>
                    <input className={inputCls} value={companyForm.legalName} onChange={(e) => setCompanyForm((f) => ({ ...f, legalName: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelCls}>Ugur / Industriýa</label>
                    <input className={inputCls} value={companyForm.industry} onChange={(e) => setCompanyForm((f) => ({ ...f, industry: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelCls}>Salgyt belgisi (TIN)</label>
                    <input className={inputCls} value={companyForm.taxId} onChange={(e) => setCompanyForm((f) => ({ ...f, taxId: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelCls}>Şäher</label>
                    <input className={inputCls} value={companyForm.city} onChange={(e) => setCompanyForm((f) => ({ ...f, city: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelCls}>Telefon</label>
                    <input className={inputCls} value={companyForm.phone} onChange={(e) => setCompanyForm((f) => ({ ...f, phone: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelCls}>Email</label>
                    <input type="email" className={inputCls} value={companyForm.email} onChange={(e) => setCompanyForm((f) => ({ ...f, email: e.target.value }))} />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={() => void handleCompanySubmit()}
                  disabled={companySaving || !companyForm.name.trim() || !companyForm.slug.trim()}
                  className="min-w-[160px]"
                >
                  {companySaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Dowam et'}
                  {!companySaving && <ArrowRight className="h-4 w-4 ml-1.5" />}
                </Button>
              </div>
            </div>
          )}

          {/* ─────────── STEP 2: DATABASE CONNECTION ─────────── */}
          {step === 'connection' && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="text-center space-y-1.5">
                <div className="mx-auto h-12 w-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-2">
                  <Database className="h-6 w-6" />
                </div>
                <h2 className="text-lg font-semibold text-white">Database baglanyşygy</h2>
                <p className="text-xs text-neutral-400">
                  MSSQL serwerine birigiň we database saýlaň. Baglanyşyk barlaglary barlanýar.
                </p>
              </div>

              {/* Server info */}
              <div className="rounded-xl border border-surface-border/60 bg-surface-card/30 p-4 space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 flex items-center gap-1.5">
                  <Server className="h-3.5 w-3.5" /> Serwer maglumatlary
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className={labelCls}>Server / IP *</label>
                    <input
                      className={`${inputCls} font-mono`}
                      value={connForm.host}
                      onChange={(e) => setConnForm((f) => ({ ...f, host: e.target.value }))}
                      placeholder="192.168.1.10 ýa-da localhost"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Port</label>
                    <input
                      type="number"
                      className={`${inputCls} font-mono`}
                      value={connForm.port}
                      onChange={(e) => setConnForm((f) => ({ ...f, port: Number(e.target.value) || 1433 }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Ulanyjy (sa) *</label>
                    <input
                      className={`${inputCls} font-mono`}
                      value={connForm.username}
                      onChange={(e) => setConnForm((f) => ({ ...f, username: e.target.value }))}
                      placeholder="sa"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Parol</label>
                    <div className="relative">
                      <input
                        type={showConnPassword ? 'text' : 'password'}
                        className={`${inputCls} font-mono pr-10`}
                        value={connForm.password}
                        onChange={(e) => setConnForm((f) => ({ ...f, password: e.target.value }))}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConnPassword((v) => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
                      >
                        {showConnPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 text-xs text-neutral-400">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={connForm.encrypt}
                      onChange={(e) => setConnForm((f) => ({ ...f, encrypt: e.target.checked }))}
                      className="h-3.5 w-3.5 rounded"
                    />
                    Encrypt
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={connForm.trustServerCertificate}
                      onChange={(e) => setConnForm((f) => ({ ...f, trustServerCertificate: e.target.checked }))}
                      className="h-3.5 w-3.5 rounded"
                    />
                    TrustServerCertificate
                  </label>
                </div>
              </div>

              {/* DB Check + select */}
              <div className="rounded-xl border border-surface-border/60 bg-surface-card/30 p-4 space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 flex items-center gap-1.5">
                  <Link2 className="h-3.5 w-3.5" /> Database saýla
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!canTestServer || loadingDbs}
                    onClick={() => void loadDatabases()}
                    className="text-xs"
                  >
                    {loadingDbs ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    {loadingDbs ? 'Birikilýär...' : 'Serwere birik we DB sanawy al'}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!canTestServer || testState === 'testing'}
                    onClick={() => void runTest(false)}
                    className="text-xs"
                  >
                    Diňe test (master)
                  </Button>

                  {testState === 'success' && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5" /> OK
                    </span>
                  )}
                  {testState === 'failed' && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-rose-400 font-medium">
                      <XCircle className="h-3.5 w-3.5" /> Şowsuz
                    </span>
                  )}
                </div>

                {testMsg && (
                  <p className={`text-[11px] break-words ${testState === 'failed' ? 'text-rose-400' : 'text-neutral-400'}`}>
                    {testMsg}
                  </p>
                )}

                {databases.length > 0 && (
                  <div>
                    <label className={labelCls}>Serwerdäki database-ler</label>
                    <select
                      className={`${inputCls} font-mono`}
                      value={connForm.database}
                      onChange={(e) => setConnForm((f) => ({ ...f, database: e.target.value }))}
                    >
                      <option value="">— saýlaň —</option>
                      {databases.map((db) => (
                        <option key={db} value={db}>{db}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className={labelCls}>Ýa-da el bilen ýaz</label>
                  <input
                    className={`${inputCls} font-mono`}
                    value={connForm.database}
                    onChange={(e) => setConnForm((f) => ({ ...f, database: e.target.value }))}
                    placeholder="Database ady"
                  />
                </div>

                {connForm.database && (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={testState === 'testing'}
                    onClick={() => void runTest(true)}
                    className="text-xs"
                  >
                    Saýlanan DB bilen test et
                  </Button>
                )}
              </div>

              {/* Nav buttons */}
              <div className="flex items-center justify-between pt-2">
                <Button variant="ghost" onClick={goBack} className="text-xs">
                  <ArrowLeft className="h-4 w-4 mr-1.5" />
                  Yza
                </Button>
                <Button
                  onClick={() => void handleConnectionNext()}
                  disabled={!connForm.host.trim() || !connForm.username.trim() || !connForm.database.trim() || testState === 'testing'}
                  className="min-w-[160px]"
                >
                  <Database className="h-4 w-4 mr-1.5" />
                  Sakla we dowam et
                </Button>
              </div>
            </div>
          )}

          {/* ─────────── STEP 3: STAFF ─────────── */}
          {step === 'staff' && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="text-center space-y-1.5">
                <div className="mx-auto h-12 w-12 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-2">
                  <Users className="h-6 w-6" />
                </div>
                <h2 className="text-lg font-semibold text-white">Täze işgärler</h2>
                <p className="text-xs text-neutral-400">
                  Täze işgärler diňe <span className="text-indigo-300 font-medium">viewer (Gözegçi)</span> roly bilen goşulýar.
                </p>
              </div>

              <div className="space-y-3">
                {staffDrafts.map((draft, idx) => (
                  <div key={draft.id} className="rounded-xl border border-surface-border/60 bg-surface-card/30 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-6 w-6 rounded-md bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-semibold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span className="text-[11px] font-medium text-indigo-300 bg-indigo-950/40 border border-indigo-800/40 px-2 py-0.5 rounded-md">
                          Viewer — Gözegçi
                        </span>
                      </div>
                      {staffDrafts.length > 1 && (
                        <button
                          onClick={() => removeStaffDraft(draft.id)}
                          className="p-1.5 rounded-md text-neutral-500 hover:text-rose-400 hover:bg-rose-950/20 transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Doly ady *</label>
                        <input
                          className={inputCls}
                          value={draft.fullName}
                          onChange={(e) => updateStaffDraft(draft.id, { fullName: e.target.value })}
                          placeholder="Ady Familiýasy"
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Login *</label>
                        <input
                          className={`${inputCls} font-mono`}
                          value={draft.username}
                          onChange={(e) => updateStaffDraft(draft.id, { username: e.target.value.toLowerCase().replace(/\s+/g, '.') })}
                          placeholder="at.familiya"
                          autoComplete="off"
                        />
                      </div>
                    </div>

                    <div>
                      <label className={labelCls}>Parol *</label>
                      <div className="relative">
                        <input
                          type="text"
                          className={`${inputCls} font-mono pr-10`}
                          value={draft.password}
                          onChange={(e) => updateStaffDraft(draft.id, { password: e.target.value })}
                          placeholder="Paroly ýazyň ýa-da generirle"
                          autoComplete="off"
                        />
                        <button
                          type="button"
                          onClick={() => updateStaffDraft(draft.id, { password: generatePassword() })}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-indigo-300 transition"
                          title="Auto-generate parol"
                        >
                          <KeyRound className="h-4 w-4" />
                        </button>
                      </div>
                      {draft.password && (
                        <p className="text-[10px] text-neutral-500 mt-1 font-mono break-all">
                          {draft.password}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={addStaffDraft}
                disabled={staffDrafts.length >= 10}
                className="w-full py-2.5 rounded-xl border border-dashed border-indigo-500/40 hover:border-indigo-500/70 hover:bg-indigo-500/5 transition flex items-center justify-center gap-2 text-xs text-indigo-300 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Başga işgär goş
              </button>

              {/* Nav buttons */}
              <div className="flex items-center justify-between pt-2">
                <Button variant="ghost" onClick={goBack} className="text-xs">
                  <ArrowLeft className="h-4 w-4 mr-1.5" />
                  Yza
                </Button>
                <Button
                  onClick={() => void handleStaffSubmit()}
                  disabled={staffSaving || staffDrafts.every((d) => !d.fullName.trim() || !d.username.trim() || !d.password)}
                  className="min-w-[160px]"
                >
                  {staffSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4 mr-1.5" />}
                  {staffSaving ? 'Goşulýar...' : 'Işgärleri goş we dowam et'}
                </Button>
              </div>
            </div>
          )}

          {/* ─────────── STEP 4: LOGIN ─────────── */}
          {step === 'login' && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="text-center space-y-1.5">
                <div className="mx-auto h-14 w-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-2">
                  <Check className="h-7 w-7" />
                </div>
                <h2 className="text-lg font-semibold text-white">Amala aşdy! 🎉</h2>
                <p className="text-xs text-neutral-400">
                  Kompaniýa, database we işgärler üstünlikli goşuldy.
                  <br />
                  Indi döreden işgäriňiz bilen ulgama giriň.
                </p>
              </div>

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                {loginError && (
                  <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-900/60 text-xs text-rose-300 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{loginError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className={labelCls}>Ulanyjy ady</label>
                  <input
                    type="text"
                    className={inputCls}
                    value={loginForm.username}
                    onChange={(e) => setLoginForm((f) => ({ ...f, username: e.target.value }))}
                    placeholder="at.familiya"
                    autoFocus
                  />
                </div>

                <div className="space-y-1.5">
                  <label className={labelCls}>Parol</label>
                  <div className="relative">
                    <input
                      type={showLoginPassword ? 'text' : 'password'}
                      className={`${inputCls} pr-10`}
                      value={loginForm.password}
                      onChange={(e) => setLoginForm((f) => ({ ...f, password: e.target.value }))}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
                    >
                      {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <Button variant="ghost" onClick={goBack} className="text-xs">
                    <ArrowLeft className="h-4 w-4 mr-1.5" />
                    Yza
                  </Button>
                  <Button
                    type="submit"
                    disabled={loginLoading || !loginForm.username.trim() || !loginForm.password}
                    className="min-w-[160px]"
                  >
                    {loginLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4 mr-1.5" />}
                    {loginLoading ? 'Barlanýar...' : 'Ulgama Girmek'}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}