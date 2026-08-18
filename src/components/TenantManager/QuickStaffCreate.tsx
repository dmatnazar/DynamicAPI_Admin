import { useState, useEffect } from 'react';
import { Eye, EyeOff, KeyRound, Lock } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useStaffStore } from '../../store/useStaffStore';
import type { StaffMember, StaffRole } from '../../types/staff.types';
import uuid from '../../lib/uuid';

const ELEVATED_ROLES: StaffRole[] = ['admin', 'manager', 'editor'];

interface Props {
  open: boolean;
  tenantId: string;
  onClose: () => void;
  onComplete: () => void;
}

const ROLES: { value: StaffRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'editor', label: 'Editor' },
  { value: 'viewer', label: 'Viewer' },
];

export function QuickStaffCreate({ open, tenantId, onClose, onComplete }: Props) {
  const { addStaff } = useStaffStore();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<StaffRole>('viewer');
  const [saving, setSaving] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPasswordVerified, setAdminPasswordVerified] = useState(false);
  const [adminPasswordError, setAdminPasswordError] = useState('');

  useEffect(() => {
    if (open) {
      setFullName('');
      setUsername('');
      setPassword('');
      setShowPassword(false);
      setRole('viewer');
      setSaving(false);
      setAdminPassword('');
      setAdminPasswordVerified(false);
      setAdminPasswordError('');
    }
  }, [open]);

  const isElevated = ELEVATED_ROLES.includes(role);

  const verifyAdminPassword = async () => {
    setAdminPasswordError('');
    if (!adminPassword) {
      setAdminPasswordError('Paroly giriziň');
      return;
    }
    try {
      const result = await window.staffAPI.verifyAdminPassword(adminPassword);
      if (result.ok) {
        setAdminPasswordVerified(true);
      } else {
        setAdminPasswordError('Nädogry parol');
        setAdminPasswordVerified(false);
      }
    } catch {
      setAdminPasswordError('Barlagda ýalňyşlyk');
      setAdminPasswordVerified(false);
    }
  };

  const handleRoleChange = (newRole: StaffRole) => {
    setRole(newRole);
    if (ELEVATED_ROLES.includes(newRole)) {
      setAdminPasswordVerified(false);
      setAdminPasswordError('');
    } else {
      setAdminPasswordVerified(false);
      setAdminPassword('');
      setAdminPasswordError('');
    }
  };

  const generatePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
    let pwd = '';
    for (let i = 0; i < 12; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(pwd);
  };

  const submit = async () => {
    if (!fullName.trim() || !username.trim() || !password) return;
    if (isElevated && !adminPasswordVerified) return;
    setSaving(true);
    try {
      const passwordHash = await window.staffAPI.hashPassword(password);
      const passwordEnc = await window.staffAPI.encryptSecret(password);
      addStaff({
        id: uuid.uuid(),
        fullName: fullName.trim(),
        username: username.trim(),
        passwordHash,
        passwordEnc,
        role,
        tenantIds: [tenantId],
        active: true,
        createdAt: new Date().toISOString(),
      });
      onComplete();
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const inputCls =
    'w-full bg-surface-raised border border-surface-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/50';

  return (
    <Modal title="Täze işgär goş" onClose={onClose} widthClass="max-w-xl" footer={null}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-neutral-400">Doly ady *</label>
            <input
              className={inputCls}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ady Familiýasy"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-neutral-400">Login *</label>
            <input
              className={inputCls}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ulanyjy_ady"
              autoComplete="off"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-neutral-400">Parol *</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              className={`${inputCls} pr-20`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="text-neutral-500 hover:text-neutral-300"
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              <button
                type="button"
                onClick={generatePassword}
                className="text-neutral-500 hover:text-indigo-300"
                title="Auto-generate"
              >
                <KeyRound size={14} />
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <label className="text-xs text-neutral-400">Rol</label>
            {isElevated && <Lock size={12} className="text-amber-500" />}
          </div>
          <select
            className={inputCls}
            value={role}
            onChange={(e) => handleRoleChange(e.target.value as StaffRole)}
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          {isElevated && (
            <p className="text-xs text-amber-500">
              Bu role üçin administrator paroly gerekli
            </p>
          )}
        </div>

        {isElevated && (
          <div className="space-y-1">
            <label className="text-xs text-neutral-400">Administrator paroly</label>
            <input
              type="password"
              className={`${inputCls} ${adminPasswordVerified ? 'border-green-500/50' : ''}`}
              value={adminPassword}
              onChange={(e) => {
                setAdminPassword(e.target.value);
                setAdminPasswordError('');
                setAdminPasswordVerified(false);
              }}
              onBlur={verifyAdminPassword}
              placeholder="Administrator paroly"
              autoComplete="off"
            />
            {adminPasswordError && (
              <p className="text-xs text-red-400">{adminPasswordError}</p>
            )}
            {adminPasswordVerified && (
              <p className="text-xs text-green-400">Parol dogry</p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1 border-t border-surface-border">
          <Button variant="ghost" className="!text-xs" onClick={onClose}>
            Ýatyr
          </Button>
          <Button
            onClick={submit}
            disabled={
              saving ||
              !fullName.trim() ||
              !username.trim() ||
              !password ||
              (isElevated && !adminPasswordVerified)
            }
          >
            {saving ? 'Saklanýar...' : 'Işgäri goş'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
