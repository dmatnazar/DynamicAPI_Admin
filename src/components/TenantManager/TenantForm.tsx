import { useState, useEffect } from 'react';
import { Eye, EyeOff, Database, User } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { PhoneInput } from '../ui/PhoneInput';
import { WebsiteInput } from '../ui/WebsiteInput';
import type { CompanyFormInput, TenantConfig, DbType } from '../../types/endpoint.types';
import { buildMssqlConnectionString, DB_TYPE_OPTIONS } from '../../types/endpoint.types';

interface Props {
  mode?: 'create' | 'edit';
  initial?: TenantConfig;
  /** When true, no outer card chrome (used inside Modal) */
  embedded?: boolean;
  onCreate?: (input: CompanyFormInput) => void | Promise<void>;
  onUpdate?: (patch: Partial<TenantConfig>) => void;
  onCancel?: () => void;
}

const empty: CompanyFormInput = {
  name: '',
  slug: '',
  legalName: '',
  taxId: '',
  registrationNumber: '',
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
  connLabel: 'Primary',
  dbType: 'mssql',
  host: '',
  port: 1433,
  database: '',
  username: '',
  password: '',
  encrypt: true,
  trustServerCertificate: true,
};

export function TenantForm({
  mode = 'create',
  initial,
  embedded,
  onCreate,
  onUpdate,
  onCancel,
}: Props) {
  const isEdit = mode === 'edit';
  const [form, setForm] = useState<CompanyFormInput>({ ...empty });
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<'unknown' | 'testing' | 'success' | 'failed'>('unknown');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEdit && initial) {
      setForm({
        ...empty,
        name: initial.name,
        slug: initial.slug,
        legalName: initial.legalName || '',
        taxId: initial.taxId || '',
        registrationNumber: initial.registrationNumber || '',
        industry: initial.industry || '',
        country: initial.country || '',
        city: initial.city || '',
        address: initial.address || '',
        phone: initial.phone || '',
        email: initial.email || '',
        website: initial.website || '',
        contactPerson: initial.contactPerson || '',
        contactPhone: initial.contactPhone || '',
        contactEmail: initial.contactEmail || '',
        notes: initial.notes || '',
      });
    } else if (!isEdit) {
      setForm({ ...empty });
    }
  }, [isEdit, initial]);

  const set = <K extends keyof CompanyFormInput>(key: K, value: CompanyFormInput[K]) => {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === 'name' && !isEdit) {
        next.slug = String(value)
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
      }
      if (key === 'dbType') {
        const opt = DB_TYPE_OPTIONS.find((o) => o.id === value);
        if (opt) next.port = opt.defaultPort || 1433;
      }
      return next;
    });
  };

  const connStr = buildMssqlConnectionString({
    host: form.host,
    port: form.port,
    database: form.database,
    username: form.username,
    password: form.password,
    encrypt: form.encrypt,
    trustServerCertificate: form.trustServerCertificate,
    dbType: form.dbType,
  });

  const canSubmitProfile = form.name.trim() && form.slug.trim();
  const canSubmitCreate =
    canSubmitProfile && form.host.trim() && form.database.trim() && form.username.trim();

  const [testMsg, setTestMsg] = useState('');
  const testConnection = async () => {
    setStatus('testing');
    setTestMsg('');
    try {
      if (!window.mssqlAPI) {
        setStatus('failed');
        setTestMsg('mssqlAPI ýok — npm install mssql && app täzeden');
        return;
      }
      const res = await window.mssqlAPI.testConnection({
        host: form.host,
        port: form.port,
        database: form.database || 'master',
        username: form.username,
        password: form.password,
        encrypt: form.encrypt !== false,
        trustServerCertificate: form.trustServerCertificate !== false,
      });
      if (res.ok) {
        setStatus('success');
        setTestMsg(res.serverVersion || 'OK');
      } else {
        setStatus('failed');
        setTestMsg(res.message);
      }
    } catch (e) {
      setStatus('failed');
      setTestMsg((e as Error).message);
    }
  };

  const submit = async () => {
    if (isEdit) {
      if (!canSubmitProfile || !onUpdate) return;
      setSaving(true);
      try {
        onUpdate({
          name: form.name.trim(),
          slug: form.slug.trim(),
          legalName: form.legalName,
          taxId: form.taxId,
          registrationNumber: form.registrationNumber,
          industry: form.industry,
          country: form.country,
          city: form.city,
          address: form.address,
          phone: form.phone,
          email: form.email,
          website: form.website,
          contactPerson: form.contactPerson,
          contactPhone: form.contactPhone,
          contactEmail: form.contactEmail,
          notes: form.notes,
        });
      } finally {
        setSaving(false);
      }
      return;
    }
    if (!canSubmitCreate || !onCreate) return;
    setSaving(true);
    try {
      await onCreate({ ...form });
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'w-full bg-surface-raised border border-surface-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/50';
  const labelCls = 'text-xs text-neutral-400';

  const body = (
    <div className="space-y-5">
      <section className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Esasy maglumat</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className={labelCls}>Kompaniýa ady *</label>
            <input className={inputCls} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Mysal: Acme LLC" />
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Slug (URL üçin) *</label>
            <input
              className={`${inputCls} font-mono`}
              value={form.slug}
              onChange={(e) => set('slug', e.target.value.toLowerCase().replace(/\s+/g, '-'))}
              placeholder="acme-llc"
            />
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Kanuny ady</label>
            <input className={inputCls} value={form.legalName || ''} onChange={(e) => set('legalName', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Ugur / Industriýa</label>
            <input className={inputCls} value={form.industry || ''} onChange={(e) => set('industry', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Salgyt belgisi (TIN)</label>
            <input className={inputCls} value={form.taxId || ''} onChange={(e) => set('taxId', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Hasaba alyş belgisi</label>
            <input className={inputCls} value={form.registrationNumber || ''} onChange={(e) => set('registrationNumber', e.target.value)} />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Salgy we aragatnaşyk</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className={labelCls}>Ýurt</label>
            <input className={inputCls} value={form.country || ''} onChange={(e) => set('country', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Şäher</label>
            <input className={inputCls} value={form.city || ''} onChange={(e) => set('city', e.target.value)} />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <label className={labelCls}>Salgy</label>
            <input className={inputCls} value={form.address || ''} onChange={(e) => set('address', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Telefon</label>
            <PhoneInput value={form.phone || ''} onChange={(v) => set('phone', v)} />
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Email</label>
            <input type="email" className={inputCls} value={form.email || ''} onChange={(e) => set('email', e.target.value)} />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <label className={labelCls}>Web sahypa</label>
            <WebsiteInput value={form.website || ''} onChange={(v) => set('website', v)} />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <User size={14} className="text-neutral-500" />
          <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Esasy kontakt şahsy</h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <label className={labelCls}>Ady we familiýasy</label>
            <input className={inputCls} value={form.contactPerson || ''} onChange={(e) => set('contactPerson', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Telefon</label>
            <PhoneInput value={form.contactPhone || ''} onChange={(v) => set('contactPhone', v)} />
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Email</label>
            <input type="email" className={inputCls} value={form.contactEmail || ''} onChange={(e) => set('contactEmail', e.target.value)} />
          </div>
        </div>
      </section>

      <section className="space-y-1.5">
        <label className={labelCls}>Belligler</label>
        <textarea className={inputCls} rows={2} value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} />
      </section>

      {!isEdit && (
        <section className="space-y-3 rounded-lg border border-surface-border bg-surface-card/50 p-3 sm:p-4">
          <div className="flex items-center gap-2">
            <Database size={14} className="text-emerald-400" />
            <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Esasy database baglanyşyk *</h4>
          </div>

          <div className="space-y-1.5">
            <label className={labelCls}>Database görnüşi</label>
            <div className="flex flex-wrap gap-2">
              {DB_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  disabled={!opt.enabled}
                  onClick={() => opt.enabled && set('dbType', opt.id as DbType)}
                  className={`px-2.5 py-1.5 rounded-md text-xs border transition ${
                    form.dbType === opt.id
                      ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                      : opt.enabled
                        ? 'border-surface-border text-neutral-300 hover:bg-surface-raised'
                        : 'border-surface-border/50 text-neutral-600 cursor-not-allowed opacity-60'
                  }`}
                >
                  {opt.label}
                  {!opt.enabled && <span className="ml-1 text-[10px] text-neutral-600">soon</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={labelCls}>Baglanyşyk ady</label>
            <input className={inputCls} value={form.connLabel || ''} onChange={(e) => set('connLabel', e.target.value)} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <label className={labelCls}>Server (host) *</label>
              <input className={`${inputCls} font-mono`} value={form.host} onChange={(e) => set('host', e.target.value)} placeholder="192.168.1.10" />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Port *</label>
              <input type="number" className={`${inputCls} font-mono`} value={form.port} onChange={(e) => set('port', Number(e.target.value) || 1433)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={labelCls}>Database ady *</label>
            <input className={`${inputCls} font-mono`} value={form.database} onChange={(e) => set('database', e.target.value)} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={labelCls}>Ulanyjy ady *</label>
              <input className={`${inputCls} font-mono`} value={form.username} onChange={(e) => set('username', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Parol</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className={`${inputCls} font-mono pr-9`}
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                />
                <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500">
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-xs text-neutral-400">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.encrypt !== false} onChange={(e) => set('encrypt', e.target.checked)} />
              Encrypt
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.trustServerCertificate !== false} onChange={(e) => set('trustServerCertificate', e.target.checked)} />
              TrustServerCertificate
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={testConnection} disabled={!form.host || !form.database}>
              Test Connection
            </Button>
            {status !== 'unknown' && (
              <Badge status={status} label={status === 'testing' ? 'Testing…' : status === 'success' ? 'Connected' : 'Failed'} />
            )}
            {testMsg && (
              <p className={`text-[11px] w-full break-words ${status === 'failed' ? 'text-red-400' : 'text-neutral-500'}`}>{testMsg}</p>
            )}
          </div>
        </section>
      )}

      <div className="flex flex-wrap justify-end gap-2 pt-1 border-t border-surface-border">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} className="!text-xs">
            Ýatyr
          </Button>
        )}
        <Button
          onClick={() => void submit()}
          disabled={isEdit ? !canSubmitProfile || saving : !canSubmitCreate || saving}
          className="!text-xs"
        >
          {saving ? 'Saklanýar…' : isEdit ? 'Üýtgeşmeleri sakla' : 'Kompaniýany goş'}
        </Button>
      </div>
    </div>
  );

  if (embedded) return body;

  return (
    <div className="rounded-xl border border-surface-border bg-surface-card p-4 sm:p-5 max-h-[calc(100vh-8rem)] overflow-y-auto">
      {body}
    </div>
  );
}
