import { useState } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { Button } from '../ui/Button';

interface Props {
  onUnlocked: () => void;
  onContinueLocked: () => void;
  hasPassword: boolean;
}

/**
 * App entry gate. Correct password → full admin UI.
 * Skip / wrong → dashboard-only (locked) mode.
 */
export function UnlockGate({ onUnlocked, onContinueLocked, hasPassword }: Props) {
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      if (!hasPassword) {
        onUnlocked();
        return;
      }
      const ok = await window.appLockAPI.verify(password);
      if (ok) onUnlocked();
      else setError('Parol nädogry');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ýalňyşlyk');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
      <div className="w-full max-w-sm rounded-2xl border border-surface-border bg-surface-card p-6 space-y-4 shadow-xl shadow-black/30">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-500/15 flex items-center justify-center">
            <Lock className="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-neutral-100">Giriş</h2>
            <p className="text-xs text-neutral-500">
              {hasPassword
                ? 'Admin funksiýalary üçin paroly giriziň'
                : 'Parol goýulmadyk — doly giriş açyk'}
            </p>
          </div>
        </div>

        {hasPassword && (
          <div className="space-y-1.5">
            <label className="text-xs text-neutral-400">Parol</label>
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                className="w-full bg-surface-raised border border-surface-border rounded-lg px-3 py-2.5 pr-9 text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void submit()}
                placeholder="••••••••"
                autoFocus
              />
              <button
                type="button"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-200"
                onClick={() => setShow((v) => !v)}
              >
                {show ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {error && <p className="text-xs text-rose-400">{error}</p>}
          </div>
        )}

        <div className="flex flex-col gap-2 pt-1">
          <Button onClick={() => void submit()} disabled={busy}>
            {hasPassword ? 'Gir' : 'Dowam et'}
          </Button>
          {hasPassword && (
            <Button variant="ghost" onClick={onContinueLocked} disabled={busy}>
              Parolsyz — diňe Dashboard
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
