import React, { useState } from 'react';
import {
  Lock,
  User,
  KeyRound,
  LogIn,
  AlertCircle,
  Building2,
  Server,
  ShieldCheck,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useDeviceStore } from '../../store/useDeviceStore';

export function StartupLogin() {
  const { login } = useAuthStore();
  const { profile } = useDeviceStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Ulanyjy ady we paroly ýazyň');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if ((window as any).authAPI?.loginStaff) {
        const res = await (window as any).authAPI.loginStaff({
          username: username.trim(),
          password,
        });
        console.log('[login] response', res);

        if (res.ok && res.user) {
          login(res.user);
          return;
        } else {
          setError(res.error || 'Ulanyjy ady ýa-da parol nädogry');
        }
      } else {
        // Fallback for dev
        login({
          id: 'dev-admin',
          username: username.trim(),
          fullName: 'Developer Admin',
          role: 'admin',
        });
      }
    } catch (err: any) {
      console.log('[login] error', err);
      setError(err?.message || 'Giriş ýalňyşlygy');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen bg-[#0A0B0F] flex items-center justify-center p-6 select-none">
      <div className="max-w-md w-full bg-surface-raised border border-surface-border rounded-2xl p-8 shadow-2xl space-y-6 animate-in fade-in">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-primary-950/60">
            <Lock className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            BI Platform Client
          </h1>
          <p className="text-xs text-neutral-400">
            Ulgama girmek üçin öz hasabyňyzyň maglumatlaryny giriziň
          </p>

          {profile?.companyName && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-card border border-surface-border text-xs font-medium text-primary-300 mt-2">
              <Building2 className="h-3.5 w-3.5" />
              <span>{profile.companyName}</span>
            </div>
          )}
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-900/60 text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-neutral-300">Ulanyjy ady:</label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
              <input
                type="text"
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="mysal: admin ýa-da at.familiýa"
                className="w-full bg-surface-card border border-surface-border rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-primary-500 transition-colors"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-neutral-300">Parol:</label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-surface-card border border-surface-border rounded-xl pl-9 pr-10 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-primary-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 px-4 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-semibold text-sm transition-all shadow-lg shadow-primary-950/50 flex items-center justify-center gap-2"
          >
            <LogIn className="h-4 w-4" />
            {loading ? 'Barlanýar...' : 'Ulgama Girmek'}
          </button>
        </form>

        {/* Footer info */}
        <div className="pt-2 border-t border-surface-border/60 flex items-center justify-between text-[11px] text-neutral-500">
          <div className="flex items-center gap-1.5 font-mono">
            <Server className="h-3 w-3" />
            <span>Host: {profile?.hostname}</span>
          </div>
          <div className="flex items-center gap-1 text-emerald-400/90 font-medium">
            <ShieldCheck className="h-3 w-3" />
            <span>Tassyklanan Enjam</span>
          </div>
        </div>
      </div>
    </div>
  );
}
