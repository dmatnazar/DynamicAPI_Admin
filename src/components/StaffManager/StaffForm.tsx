import { useState, useEffect } from 'react';
import { Eye, EyeOff, Shield } from 'lucide-react';
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
  { value: 'admin', label: 'Admin — full access' },
  { value: 'editor', label: 'Editor — can edit endpoints' },
  { value: 'viewer', label: 'Viewer — read only' },
];

export function StaffForm({ editing, onCreate, onUpdate, onCancelEdit }: Props) {
  const { tenants } = useTenantStore();

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<StaffRole>('editor');
  const [tenantIds, setTenantIds] = useState<string[]>([]);
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setFullName(editing.fullName);
      setUsername(editing.username);
      setRole(editing.role);
      setTenantIds(editing.tenantIds);
      setActive(editing.active);
      setPassword('');
    } else {
      setFullName('');
      setUsername('');
      setRole('editor');
      setTenantIds([]);
      setActive(true);
      setPassword('');
    }
  }, [editing]);

  const toggleTenant = (id: string) => {
    setTenantIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  };

  const submit = async () => {
    if (!fullName || !username) return;
    if (!editing && !password) return;

    setSaving(true);
    try {
      if (editing) {
        const patch: Partial<StaffMember> = { fullName, username, role, tenantIds, active };
        if (password) {
          patch.passwordHash = await window.staffAPI.hashPassword(password);
        }
        onUpdate(editing.id, patch);
      } else {
        const passwordHash = await window.staffAPI.hashPassword(password);
        onCreate({
          id: uuid.uuid(),
          fullName,
          username,
          passwordHash,
          role,
          tenantIds,
          active,
          createdAt: new Date().toISOString(),
        });
      }
      onCancelEdit();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-surface-border bg-surface-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-100">
          {editing ? `Edit ${editing.fullName}` : 'New Worker'}
        </h3>
        {editing && (
          <button onClick={onCancelEdit} className="text-xs text-neutral-500 hover:text-neutral-200">
            Cancel edit
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          className="bg-surface-raised border border-surface-border rounded-md px-3 py-2 text-sm w-full"
          placeholder="Full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
        <input
          className="bg-surface-raised border border-surface-border rounded-md px-3 py-2 text-sm font-mono w-full"
          placeholder="username"
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, '.'))}
        />
      </div>

      <div className="relative">
        <input
          type={showPassword ? 'text' : 'password'}
          className="w-full bg-surface-raised border border-surface-border rounded-md px-3 py-2 pr-9 text-sm font-mono"
          placeholder={editing ? 'Leave blank to keep current password' : 'Password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-200"
        >
          {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      <p className="text-[11px] text-neutral-600">
        Passwords are hashed with scrypt in the Electron main process (window.staffAPI) — the
        plaintext value never gets stored anywhere.
      </p>

      <div className="space-y-1.5">
        <label className="text-xs text-neutral-400 flex items-center gap-1.5">
          <Shield size={12} /> Role
        </label>
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
        <label className="text-xs text-neutral-400">Company access</label>
        <div className="flex flex-wrap gap-2">
          {tenants.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => toggleTenant(t.id)}
              className={`text-xs px-2.5 py-1 rounded-full border transition ${
                tenantIds.includes(t.id)
                  ? 'bg-accent/10 border-accent/40 text-accent'
                  : 'border-surface-border text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {t.name}
            </button>
          ))}
          {tenants.length === 0 && (
            <p className="text-xs text-neutral-600 italic">Add a company first to grant access.</p>
          )}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-neutral-300">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Active — can sign in
      </label>

      <div className="flex justify-end">
        <Button onClick={submit} disabled={!fullName || !username || (!editing && !password) || saving}>
          {saving ? 'Saving…' : editing ? 'Save changes' : 'Add worker'}
        </Button>
      </div>
    </div>
  );
}
