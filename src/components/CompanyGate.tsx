import { useEffect, useState, useMemo } from 'react';
import { Building2, Plus, LogIn, ChevronRight, Check, Database, Users, KeyRound, ArrowRight, AlertCircle } from 'lucide-react';
import { useTenantStore } from '../store/useTenantStore';
import { useAuthStore } from '../store/useAuthStore';
import { TenantForm } from '../components/TenantManager/TenantForm';
import { ConnectionFormModal } from '../components/TenantManager/ConnectionFormModal';
import { QuickStaffCreate } from '../components/TenantManager/QuickStaffCreate';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
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

type OnboardingStep = 'select' | 'company' | 'connection' | 'staff' | 'login';

interface OnboardingState {
  step: OnboardingStep;
  companyId: string | null;
}

const STEPS = [
  { id: 'company', label: 'Kompaniýa', icon: Building2, description: 'Esasy maglumatlar' },
  { id: 'connection', label: 'Database', icon: Database, description: 'Baglanyşyk' },
  { id: 'staff', label: 'Işgär', icon: Users, description: 'Ulanyjy döretmek' },
  { id: 'login', label: 'Giriş', icon: KeyRound, description: 'Login we parol' },
] as const;

export function CompanyGate({ user, deviceCompanyId, isNewCompany }: Props) {
  const { tenants, activeTenantId, setActiveTenant, createCompanyBasic, addConnection, hydrated } = useTenantStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingState>({ step: 'select', companyId: null });
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    if (deviceCompanyId && tenants.some((t) => t.id === deviceCompanyId)) {
      setSelectedId(deviceCompanyId);
      setActiveTenant(deviceCompanyId);
    } else if (tenants.length > 0 && !activeTenantId && !selectedId) {
      setSelectedId(tenants[0].id);
    }
  }, [hydrated, tenants.length, activeTenantId, selectedId, deviceCompanyId]);

  useEffect(() => {
    if (isNewCompany) {
      setOnboarding({ step: 'company', companyId: null });
    }
  }, [isNewCompany]);

  const handleSelectCompany = (id: string) => {
    console.log('[CompanyGate] select company', id);
    setSelectedId(id);
    setActiveTenant(id);
  };

  const handleContinue = () => {
    console.log('[CompanyGate] continue', selectedId, 'activeTenantId after:', useTenantStore.getState().activeTenantId);
    if (selectedId) {
      setActiveTenant(selectedId);
    }
  };

  const startOnboarding = () => setOnboarding({ step: 'company', companyId: null });

  const handleCompanyCreated = async (input: { name: string; slug: string }) => {
    const company = await createCompanyBasic({
      name: input.name,
      slug: input.slug,
      isActive: true,
    });
    setSelectedId(company.id);
    setOnboarding({ step: 'connection', companyId: company.id });
  };

  const handleConnectionSaved = (conn: TenantConnection) => {
    if (onboarding.companyId) {
      addConnection(onboarding.companyId, conn);
    }
    setOnboarding((prev) => ({ ...prev, step: 'staff' }));
  };

  const handleStaffCreated = () => {
    setOnboarding((prev) => ({ ...prev, step: 'login' }));
  };

  const cancelOnboarding = () => {
    setOnboarding({ step: 'select', companyId: null });
  };

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
        });
        console.log('[CompanyGate] login response', res);
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
      console.log('[CompanyGate] login error', err);
      setLoginError(err?.message || 'Giriş ýalňyşlygy');
    } finally {
      setLoginLoading(false);
    }
  };

  const currentStepIndex = STEPS.findIndex((s) => s.id === onboarding.step);
  const activeCompanies = tenants.filter((t) => t.isActive !== false);
  const hasCompanies = tenants.length > 0;

  // ── ONBOARDING STEPPER ──────────────────────────────────────────────────
  if (onboarding.step !== 'select') {
    const stepIndex = STEPS.findIndex((s) => s.id === onboarding.step);
    const progress = stepIndex >= 0 ? ((stepIndex + 1) / STEPS.length) * 100 : 0;

    return (
      <div className="h-screen w-screen bg-[#0A0B0F] flex items-center justify-center p-4 sm:p-6 select-none">
        <div className="w-full max-w-xl bg-surface-raised border border-surface-border rounded-2xl shadow-2xl overflow-hidden">
          {/* Progress Bar */}
          <div className="h-1.5 bg-surface-border">
            <div className="h-full bg-primary-500 transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
          </div>

          {/* Step Indicators */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-surface-border/60 bg-surface-card/30">
            {STEPS.map((step, idx) => {
              const isActive = step.id === onboarding.step;
              const isCompleted = idx < stepIndex;
              const Icon = step.icon;
              return (
                <div key={step.id} className="flex flex-col items-center gap-1.5 flex-1">
                  <div
                    className={`h-9 w-9 rounded-xl flex items-center justify-center border transition-all ${
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
                      {step.label}
                    </p>
                    <p className="text-[9px] text-neutral-600 hidden sm:block">{step.description}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Step Content */}
          <div className="p-5 sm:p-6 min-h-[320px]">
            {onboarding.step === 'company' && (
              <div className="space-y-4">
                <div className="text-center space-y-1.5 mb-4">
                  <h2 className="text-lg font-semibold text-white">Täze kompaniýa maglumatlary</h2>
                  <p className="text-xs text-neutral-400">Kärhananyň adyny we esasy maglumatlaryny giriziň</p>
                </div>
                <TenantForm mode="create" quick embedded onCreate={handleCompanyCreated} onCancel={cancelOnboarding} />
              </div>
            )}

            {onboarding.step === 'connection' && onboarding.companyId && (
              <div className="space-y-4">
                <div className="text-center space-y-1.5 mb-4">
                  <h2 className="text-lg font-semibold text-white">Database baglanyşygy</h2>
                  <p className="text-xs text-neutral-400">Täze kompaniýa üçin MSSQL serweriniň maglumatlaryny giriziň</p>
                </div>
                <ConnectionFormModal open onClose={cancelOnboarding} onSave={handleConnectionSaved} />
              </div>
            )}

            {onboarding.step === 'staff' && onboarding.companyId && (
              <div className="space-y-4">
                <div className="text-center space-y-1.5 mb-4">
                  <h2 className="text-lg font-semibold text-white">Täze işgär döretmek</h2>
                  <p className="text-xs text-neutral-400">Täze kompaniýa üçin giriş maglumatlaryny dörediň</p>
                </div>
                <QuickStaffCreate open tenantId={onboarding.companyId} onClose={cancelOnboarding} onComplete={handleStaffCreated} />
              </div>
            )}

            {onboarding.step === 'login' && (
              <div className="space-y-5">
                <div className="text-center space-y-1.5">
                  <div className="mx-auto h-12 w-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3">
                    <Check className="h-6 w-6" />
                  </div>
                  <h2 className="text-lg font-semibold text-white">Täze kompaniýa dörediňiz!</h2>
                  <p className="text-xs text-neutral-400">Indi gireniňiz üçin ulanyjy ady we parolyňyzy giriziň</p>
                </div>

                <form onSubmit={handleLoginSubmit} className="space-y-3">
                  {loginError && (
                    <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-900/60 text-xs text-rose-300 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{loginError}</span>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-neutral-300">Ulanyjy ady</label>
                    <input
                      type="text"
                      value={loginForm.username}
                      onChange={(e) => setLoginForm((f) => ({ ...f, username: e.target.value }))}
                      placeholder="Ulanyjy ady"
                      className="w-full bg-surface-card border border-surface-border rounded-xl px-3 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-primary-500 transition-colors"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-neutral-300">Parol</label>
                    <input
                      type="password"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm((f) => ({ ...f, password: e.target.value }))}
                      placeholder="••••••••"
                      className="w-full bg-surface-card border border-surface-border rounded-xl px-3 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-primary-500 transition-colors"
                    />
                  </div>
                  <Button type="submit" disabled={loginLoading || !loginForm.username.trim() || !loginForm.password} className="w-full">
                    <LogIn className="h-4 w-4 mr-1.5" />
                    {loginLoading ? 'Barlanýar...' : 'Ulgama Girmek'}
                  </Button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── COMPANY SELECTION ───────────────────────────────────────────────────
  return (
    <div className="h-screen w-screen bg-[#0A0B0F] flex items-center justify-center p-4 sm:p-6 select-none">
      <div className="w-full max-w-md bg-surface-raised border border-surface-border rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto h-12 w-12 rounded-xl bg-primary-500/20 border border-primary-500/30 flex items-center justify-center text-primary-400">
            <Building2 className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-white">Kärhana saýlaň</h1>
          <p className="text-xs text-neutral-400">
            @{user.username} — size <span className="text-amber-400 font-medium">{user.role}</span> rol belli.
            Işleýän kärhanany saýlaň ýa-da täze goşuň.
          </p>
        </div>

        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {/* New Company Button */}
          <button
            onClick={startOnboarding}
            className="w-full text-left p-3 rounded-xl border border-dashed border-surface-border hover:border-primary-500/50 hover:bg-primary-500/5 transition flex items-center gap-3 group"
          >
            <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 bg-primary-500/10 text-primary-400 group-hover:bg-primary-500/20 transition">
              <Plus size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-primary-300">Täze kompaniýa</p>
              <p className="text-[11px] text-neutral-500">Täze kärhana döretmek üçin basyň</p>
            </div>
            <ArrowRight size={14} className="text-neutral-500 group-hover:text-primary-400 transition shrink-0" />
          </button>

          {!hasCompanies && (
            <div className="text-center py-6 space-y-3">
              <p className="text-sm text-neutral-400">Entäk kompaniýa ýok</p>
            </div>
          )}

          {hasCompanies &&
            activeCompanies.map((t) => {
              const selected = selectedId === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => handleSelectCompany(t.id)}
                  className={`w-full text-left p-3 rounded-xl border transition flex items-center gap-3 ${
                    selected
                      ? 'bg-primary-600/15 border-primary-500/40'
                      : 'border-surface-border hover:bg-surface-card/60'
                  }`}
                >
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                    selected ? 'bg-primary-500/20 text-primary-300' : 'bg-surface-card text-neutral-400'
                  }`}>
                    <Building2 size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium truncate ${selected ? 'text-white' : 'text-neutral-200'}`}>
                      {t.name}
                    </p>
                    <p className="text-[11px] font-mono text-neutral-500 truncate">/{t.slug}</p>
                  </div>
                  {selected && <Check size={16} className="text-primary-400 shrink-0" />}
                </button>
              );
            })}

          {hasCompanies && tenants.filter((t) => t.isActive === false).length > 0 && (
            <div className="pt-2">
              <p className="text-[10px] uppercase tracking-wider text-neutral-600 font-semibold mb-2 px-1">Passiw</p>
              {tenants
                .filter((t) => t.isActive === false)
                .map((t) => {
                  const selected = selectedId === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => handleSelectCompany(t.id)}
                      className={`w-full text-left p-3 rounded-xl border transition flex items-center gap-3 opacity-75 ${
                        selected
                          ? 'bg-primary-600/15 border-primary-500/40'
                          : 'border-surface-border hover:bg-surface-card/60'
                      }`}
                    >
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                        selected ? 'bg-primary-500/20 text-primary-300' : 'bg-surface-card text-neutral-500'
                      }`}>
                        <Building2 size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium truncate ${selected ? 'text-white' : 'text-neutral-400'}`}>
                          {t.name}
                        </p>
                        <p className="text-[11px] font-mono text-neutral-600 truncate">/{t.slug}</p>
                      </div>
                      {selected && <Check size={16} className="text-primary-400 shrink-0" />}
                    </button>
                  );
                })}
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-surface-border">
          <Button onClick={handleContinue} disabled={!selectedId} className="w-full">
            <LogIn className="h-4 w-4 mr-1.5" />
            Dowam et
            <ChevronRight className="h-4 w-4 ml-1.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
