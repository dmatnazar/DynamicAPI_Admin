import { useState, useEffect } from 'react';
import { Eye, EyeOff, Shield, UserPlus } from 'lucide-react';
import { Button } from '../ui/Button';
import { useTenantStore } from '../../store/useTenantStore';
import type { StaffMember, StaffRole } from '../../types/staff.types';
import uuid from '../../lib/uuid';

interface Props {
  editing: StaffMember | null;
  onCreate: (member: StaffMember) => void;
  onUpdate: (id: string, patch: Partial<StaffMember>) => void;
  onCancelEdit: () => void;
}

const ROLES: { value: StaffRole; label: string }[] = [
  { value: 'admin', label: 'Admin — doly elýeterlilik' },
  { value: 'manager', label: 'Manager — kärhana dolandyryjysy' },
  { value: 'editor', label: 'Editor — endpoint üýtgedip bilýär' },
  { value: 'viewer', label: 'Viewer — diňe okamak' },
];

function phoneLocalPart(phone?: string): string {
  if (!phone) return '';
  return phone.replace(/^\+?993/, '').replace(/\D/g, '').slice(0, 8);
}

export function StaffForm({ editing, onCreate, onUpdate, onCancelEdit }: Props) {
  const { tenants } = useTenantStore();

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<StaffRole>('editor');
  const [tenantIds, setTenantIds] = useState<string[]>([]);
  const [active, setActive] = useState(true);
  const [phoneLocal, setPhoneLocal] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [hadStoredPassword, setHadStoredPassword] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (editing) {
        setFullName(editing.fullName);
        setUsername(editing.username);
        setRole(editing.role);
        setTenantIds(editing.tenantIds);
        setActive(editing.active);
        setPhoneLocal(phoneLocalPart(editing.phone));
        setEmail(editing.email || '');
        setShowPassword(false);
        if (editing.passwordEnc) {
          try {
            const plain = await window.staffAPI.decryptSecret(editing.passwordEnc);
            if (!cancelled) {
              setPassword(plain || '');
              setHadStoredPassword(Boolean(plain));
            }
          } catch {
            if (!cancelled) {
              setPassword('');
              setHadStoredPassword(false);
            }
          }
        } else {
          setPassword('');
          setHadStoredPassword(false);
        }
      } else {
        setFullName('');
        setUsername('');
        setRole('editor');
        setTenantIds([]);
        setActive(true);
        setPassword('');
        setPhoneLocal('');
        setEmail('');
        setHadStoredPassword(false);
        setShowPassword(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editing]);

  const toggleTenant = (id: string) => {
    setTenantIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  };

  const submit = async () => {
    if (!fullName || !username) return;
    if (!editing && !password) return;
    if (tenantIds.length === 0) {
      alert('Iň azyndan bir kompaniýa saýlaň');
      return;
    }

    setSaving(true);
    try {
      const phone = phoneLocal ? `+993${phoneLocal.replace(/\D/g, '').slice(0, 8)}` : undefined;
      if (editing) {
        const patch: Partial<StaffMember> = {
          fullName,
          username,
          role,
          tenantIds,
          active,
          phone,
          email: email || undefined,
        };
        // Always re-hash if password field has a value (including revealed old one if changed)
        if (password) {
          patch.passwordHash = await window.staffAPI.hashPassword(password);
          patch.passwordEnc = await window.staffAPI.encryptSecret(password);
        }
        onUpdate(editing.id, patch);
      } else {
        const passwordHash = await window.staffAPI.hashPassword(password);
        const passwordEnc = await window.staffAPI.encryptSecret(password);
        onCreate({
          id: uuid.uuid(),
          fullName,
          username,
          passwordHash,
          passwordEnc,
          role,
          tenantIds,
          active,
          phone,
          email: email || undefined,
          createdAt: new Date().toISOString(),
        });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-neutral-400">Doly ady *</label>
          <input
            className="w-full bg-surface-raised border border-surface-border rounded-md px-3 py-2 text-sm"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Ady Familiýasy"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-neutral-400">Login *</label>
          <input
            className="w-full bg-surface-raised border border-surface-border rounded-md px-3 py-2 text-sm"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="ulanyjy_ady"
            autoComplete="off"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-neutral-400">Telefon</label>
          <div className="flex rounded-md overflow-hidden border border-surface-border">
            <span className="flex items-center px-2.5 bg-surface-raised text-neutral-400 text-xs border-r border-surface-border select-none">
              +993
            </span>
            <input
              className="flex-1 bg-surface-raised px-3 py-2 text-sm outline-none"
              value={phoneLocal}
              onChange={(e) => setPhoneLocal(e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="6X XXXXXX"
              inputMode="numeric"
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-neutral-400">Email (Gmail)</label>
          <input
            type="email"
            className="w-full bg-surface-raised border border-surface-border rounded-md px-3 py-2 text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ulanyjy@gmail.com"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-neutral-400">
          Parol {editing ? (hadStoredPassword ? '(saklanan parol görkezildi)' : '* täze ýazyň') : '*'}
        </label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            className="w-full bg-surface-raised border border-surface-border rounded-md px-3 py-2 pr-9 text-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            placeholder={editing && !hadStoredPassword ? 'Täze parol ýazyň' : ''}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
          >
            {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <p className="text-[11px] text-neutral-600 flex items-center gap-1">
          <Shield size={10} /> Göz bilen görüp bilersiňiz · OS-de şifrlenen saklanýar
        </p>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-neutral-400">Rol</label>
        <select
          className="w-full bg-surface-raised border border-surface-border rounded-md px-3 py-2 text-sm"
          value={role}
          onChange={(e) => setRole(e.target.value as StaffRole)}
        >
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-neutral-400">Kompaniýalar *</label>
        {tenants.length === 0 ? (
          <p className="text-xs text-amber-400">Ilki kompaniýa goşuň (Companies tab)</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tenants.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleTenant(t.id)}
                className={`px-2.5 py-1 rounded-lg text-xs border transition ${
                  tenantIds.includes(t.id)
                    ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-200'
                    : 'bg-surface-raised border-surface-border text-neutral-400 hover:border-neutral-500'
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="rounded border-surface-border"
        />
        Işjeň (active)
      </label>

      <div className="flex gap-2 pt-1">
        <Button onClick={submit} disabled={saving}>
          {saving ? 'Saklanýar...' : editing ? 'Ýatda sakla' : 'Goş'}
        </Button>
        {editing && (
          <Button variant="ghost" onClick={onCancelEdit}>
            Ýatyr
          </Button>
        )}
      </div>
    </div>
  );
}
