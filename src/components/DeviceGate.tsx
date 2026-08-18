import React, { useEffect, useState } from 'react';
import {
  Server,
  AlertTriangle,
  Ban,
  RefreshCw,
  Copy,
  Check,
  Cpu,
  HardDrive,
  Globe,
  ShieldAlert,
  Settings,
  Lock,
  Eye,
  EyeOff,
  Wifi,
  WifiOff,
  ExternalLink,
} from 'lucide-react';
import { useDeviceStore } from '../store/useDeviceStore';

interface Props {
  children: React.ReactNode;
}

export function DeviceGate({ children }: Props) {
  const { profile, loading, checking, error, fetchProfile, checkStatus, registerDevice, devicePermission, checkPermission, requestPermission, setError, subscribeToDeviceStatus } =
    useDeviceStore();
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [settingsUnlocked, setSettingsUnlocked] = useState(false);

  // VPS settings state
  const [gatewayUrl, setGatewayUrl] = useState('http://localhost:4000');
  const [adminSecret, setAdminSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState('');
  const [health, setHealth] = useState<'unknown' | 'checking' | 'online' | 'offline'>('unknown');
  const [rawRegisterError, setRawRegisterError] = useState<string | null>(null);

  // Load current settings on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const settings = await window.dbAPI.getSettings();
        if (cancelled) return;
        if (settings?.gatewayUrl) setGatewayUrl(settings.gatewayUrl);
        if (settings?.adminSecret) setAdminSecret(settings.adminSecret);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Initial registration on mount
  useEffect(() => {
    let cancelled = false;
    setRawRegisterError(null);
    fetchProfile().then((p) => {
      if (cancelled) return;
      if (p && p.status === 'approved') {
        checkStatus();
        return;
      }
      registerDevice();
    });
    return () => { cancelled = true; };
  }, [fetchProfile, registerDevice, checkStatus]);

  // Refresh permission when store notifies of status change
  useEffect(() => {
    return subscribeToDeviceStatus(() => {
      // Only re-check permission if we're already authenticated and approved
      // The background polling in App.tsx handles regular checks
    });
  }, [subscribeToDeviceStatus, checkPermission]);

  // Listen for register errors from store
  useEffect(() => {
    if (error) {
      setRawRegisterError(error);
    }
  }, [error]);

  const handleCopyId = () => {
    if (!profile?.id) return;
    navigator.clipboard.writeText(profile.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSettingsClick = () => {
    setShowSettings(true);
    setPassword('');
    setPasswordError('');
    setSettingsUnlocked(false);
  };

  const handleVerifyPassword = async () => {
    if (!password) return;
    setVerifying(true);
    setPasswordError('');
    try {
      const ok = await window.appLockAPI.verify(password);
      if (ok) {
        setSettingsUnlocked(true);
        // Refresh settings from DB
        const settings = await window.dbAPI.getSettings();
        setGatewayUrl(settings.gatewayUrl || 'http://localhost:4000');
        setAdminSecret(settings.adminSecret || '');
        setHealth('unknown');
      } else {
        setPasswordError('Parol nädogry');
      }
    } catch {
      setPasswordError('Barlap bolmady');
    } finally {
      setVerifying(false);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setSettingsMsg('');
    try {
      const cleanUrl = gatewayUrl.trim().replace(/\/$/, '');
      await window.dbAPI.updateSettings({
        gatewayUrl: cleanUrl,
        adminSecret: adminSecret.trim(),
      });
      await window.vaultAPI.set('gatewayUrl', cleanUrl);
      await window.vaultAPI.set('adminSyncSecret', adminSecret.trim());
      setSettingsMsg('Sazlamalar saklandy');
      setHealth('unknown');
      setRawRegisterError(null);
      // Test health
      try {
        const res = await fetch(`${cleanUrl}/health`);
        setHealth(res.ok ? 'online' : 'offline');
      } catch {
        setHealth('offline');
      }
    } catch {
      setSettingsMsg('Ýalňyşlyk ýüze çykdy');
    } finally {
      setSavingSettings(false);
      setTimeout(() => setSettingsMsg(''), 4000);
    }
  };

  const handleTestHealth = async () => {
    setHealth('checking');
    try {
      const res = await fetch(`${gatewayUrl.trim().replace(/\/$/, '')}/health`);
      setHealth(res.ok ? 'online' : 'offline');
    } catch {
      setHealth('offline');
    }
  };

  const handleRetryRegister = async () => {
    setRawRegisterError(null);
    await registerDevice();
  };

  if (loading) {
    return (
      <div className="h-screen w-screen bg-[#0A0B0F] flex flex-col items-center justify-center text-neutral-400 select-none">
        <RefreshCw className="h-8 w-8 animate-spin text-primary-500 mb-3" />
        <p className="text-sm font-medium">Enjam aýratynlyklary barlanýar...</p>
      </div>
    );
  }

  // If approved, render the app!
  if (profile?.status === 'approved') {
    return <>{children}</>;
  }

  // If permission denied (blocked or deleted)
  if (profile?.status === 'blocked' || devicePermission?.granted === false) {
    const permReason = devicePermission?.reason || (profile?.status === 'blocked' ? 'blocked' : 'error');
    return (
      <div className="h-screen w-screen bg-[#0A0B0F] flex items-center justify-center p-6 select-none">
        <div className="max-w-md w-full bg-surface-raised border border-rose-900/60 rounded-2xl p-8 shadow-2xl text-center space-y-5 animate-in fade-in">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-rose-950/80 border border-rose-800/80 flex items-center justify-center text-rose-400">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Enjamyň Rugsaty Ýok</h1>
            <p className="text-sm text-neutral-400 mt-2">
              {permReason === 'deleted'
                ? 'Bu enjam administrator tarapyndan ulgamdan aýryldy. Maglumat sinhronizasiýasy we baza baglanyşygy togtadyldy.'
                : 'Bu kompýuterdäki programma administrator tarapyndan petiklenen. Maglumat sinhronizasiýasy we baza baglanyşygy togtadyldy.'}
            </p>
            <p className="text-xs text-neutral-500 mt-2">
              Enjamyň girişini dikeltmek üçin administrator bilen habarlaşyň we "Rugsat Soraş" düwmesine basyň.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-surface-card border border-surface-border text-left text-xs space-y-1.5 font-mono text-neutral-400">
            <div><span className="text-neutral-500">Device ID:</span> {profile?.id || '—'}</div>
            <div><span className="text-neutral-500">Host:</span> {profile?.hostname || '—'}</div>
            <div><span className="text-neutral-500">Firma:</span> {profile?.companyName || profile?.tenantSlug || '—'}</div>
          </div>

          <div className="space-y-2">
            <button
              onClick={async () => {
                const res = await requestPermission();
                if (!res.ok) {
                  setError(res.error || 'Rugsat soraş bolmady');
                }
              }}
              disabled={checking}
              className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-medium text-sm transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
              Rugsat Soraş
            </button>

            <button
              onClick={() => checkPermission()}
              disabled={checking}
              className="w-full py-2.5 px-4 rounded-xl bg-surface-border hover:bg-neutral-800 text-white font-medium text-sm transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
              Ýagdaýy Täzeden Barlamak
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If pending approval — show waiting screen with diagnostics
  return (
    <div className="h-screen w-screen bg-[#0A0B0F] flex items-center justify-center p-6 select-none">
      <div className="max-w-lg w-full bg-surface-raised border border-surface-border rounded-2xl p-8 shadow-2xl space-y-5 animate-in fade-in">
        {/* Top visual indicator */}
        <div className="text-center space-y-3">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-amber-950/60 border border-amber-800/60 flex items-center justify-center text-amber-400 relative">
            <Server className="h-8 w-8" />
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500"></span>
            </span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Administrator Tassyklamagyna Garaşylýar
          </h1>
          <p className="text-sm text-neutral-400">
            Bu enjam gurnaldy we ulgama bellige alyndy. Programmany ulanmak üçin BI Platformanyň <strong>"Enjamlar"</strong> sahypasyndan administrator tarapyndan tassyklanmaly we kärhana baglanmaly.
          </p>
        </div>

        {/* Connection diagnostics */}
        <div className="rounded-xl bg-surface-card border border-surface-border p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-surface-border/60 pb-2.5">
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
              Baglanyşyk Diagnostics
            </span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${
              health === 'online'
                ? 'bg-emerald-950/80 border border-emerald-800/80 text-emerald-300'
                : health === 'offline'
                  ? 'bg-rose-950/80 border border-rose-800/80 text-rose-300'
                  : 'bg-slate-800 text-slate-400'
            }`}>
              {health === 'online' ? <Wifi className="h-3 w-3" /> : health === 'offline' ? <WifiOff className="h-3 w-3" /> : <Server className="h-3 w-3" />}
              {health === 'online' ? 'Gateway Online' : health === 'offline' ? 'Gateway Offline' : '...'}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between bg-surface-raised/80 p-2 rounded-lg">
              <span className="text-neutral-400 font-mono">Gateway URL:</span>
              <span className="font-mono text-white font-medium select-all max-w-[200px] truncate" title={gatewayUrl}>
                {gatewayUrl || '—'}
              </span>
            </div>

            <div className="flex items-center justify-between bg-surface-raised/80 p-2 rounded-lg">
              <span className="text-neutral-400 font-mono">Device ID:</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-white font-medium select-all text-[11px]">
                  {profile?.id || '—'}
                </span>
                <button
                  onClick={handleCopyId}
                  className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
                  title="Device ID göçürmek"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-neutral-300 font-mono text-[11px]">
              <div className="bg-surface-raised/50 p-2 rounded-lg flex items-center gap-2">
                <Server className="h-3.5 w-3.5 text-neutral-500" />
                <span className="truncate">{profile?.hostname || 'Hostname'}</span>
              </div>
              <div className="bg-surface-raised/50 p-2 rounded-lg flex items-center gap-2">
                <HardDrive className="h-3.5 w-3.5 text-neutral-500" />
                <span>RAM: {profile?.ramGb ? `${profile.ramGb} GB` : '—'}</span>
              </div>
              <div className="bg-surface-raised/50 p-2 rounded-lg flex items-center gap-2">
                <Cpu className="h-3.5 w-3.5 text-neutral-500" />
                <span className="truncate">{profile?.osPlatform} {profile?.osRelease}</span>
              </div>
              <div className="bg-surface-raised/50 p-2 rounded-lg flex items-center gap-2">
                <Globe className="h-3.5 w-3.5 text-neutral-500" />
                <span>{profile?.ipAddress || 'LAN IP'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Error display */}
        {(error || rawRegisterError) && (
          <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-900/60 text-xs text-rose-300 space-y-2">
            <div className="flex items-start gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium">Enjamy gazanyp bolmady</p>
                <p className="text-rose-200/80 break-all">{error || rawRegisterError}</p>
              </div>
            </div>
            <div className="flex gap-2 ml-6">
              <button
                onClick={handleRetryRegister}
                disabled={checking}
                className="text-[11px] px-2.5 py-1 rounded-md bg-rose-900/40 hover:bg-rose-800/60 text-rose-200 transition-colors flex items-center gap-1"
              >
                <RefreshCw className={`h-3 w-3 ${checking ? 'animate-spin' : ''}`} />
                Täzeden synanş
              </button>
              <button
                onClick={handleSettingsClick}
                className="text-[11px] px-2.5 py-1 rounded-md bg-surface-border hover:bg-neutral-800 text-neutral-300 transition-colors flex items-center gap-1"
              >
                <Settings className="h-3 w-3" />
                Sazlamalar
              </button>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="space-y-2">
          <button
            onClick={() => checkStatus()}
            disabled={checking}
            className="w-full py-2.5 px-4 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-semibold text-sm transition-all shadow-lg shadow-primary-950/50 flex items-center justify-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
            {checking ? 'Barlanýar...' : 'Ýagdaýy Täzeden Barlamak'}
          </button>

          <div className="flex gap-2">
            <button
              onClick={handleTestHealth}
              className="flex-1 py-2 px-3 rounded-xl bg-surface-border hover:bg-neutral-800 text-neutral-300 text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
            >
              {health === 'online' ? <Wifi className="h-3.5 w-3.5 text-emerald-400" /> : <WifiOff className="h-3.5 w-3.5 text-rose-400" />}
              Baglanyşyk barla
            </button>
            <button
              onClick={handleSettingsClick}
              className="flex-1 py-2 px-3 rounded-xl bg-surface-border hover:bg-neutral-800 text-neutral-300 text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
            >
              <Settings className="h-3.5 w-3.5" />
              VPS Sazlamalary
            </button>
          </div>

          <p className="text-[11px] text-center text-neutral-500">
            Admin tassyklan dessine programma awtomatiki açylar (her 6 sekuntdan barlanýar).
          </p>
        </div>

        {/* Help text */}
        <div className="p-3 rounded-lg bg-slate-900/40 border border-slate-800 text-[11px] text-slate-400 space-y-1">
          <p className="font-medium text-slate-300">Göz ýetirmeli zatlar:</p>
          <ul className="list-disc list-inside space-y-0.5 ml-1">
            <li>VPS Gateway işleýärmi? <span className="font-mono">{gatewayUrl}/health</span> sahypasyny browserde açyp barlaň.</li>
            <li>BI Platform Settings-da şol bir Gateway URL we Admin Secret goýlan bolmaly.</li>
            <li>Enjam tassyklanandan soň bu programma awtomatiki açylar.</li>
          </ul>
        </div>

        {/* Settings Modal / Overlay */}
        {showSettings && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-surface-raised border border-surface-border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
              {!settingsUnlocked ? (
                // Password Gate
                <>
                  <div className="text-center space-y-2">
                    <div className="mx-auto h-12 w-12 rounded-xl bg-amber-950/60 border border-amber-800/60 flex items-center justify-center text-amber-400">
                      <Lock className="h-6 w-6" />
                    </div>
                    <h2 className="text-lg font-bold text-white">Sazlamalar Için Parol</h2>
                    <p className="text-xs text-neutral-400">
                      VPS baglanyşyk sazlamalaryny görmek we üýtgetmek üçin paroly giriziň.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-neutral-400">Parol</label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleVerifyPassword()}
                          placeholder="Default: admin1001"
                          className="w-full h-10 rounded-xl border border-surface-border bg-surface-card px-3 pr-10 text-sm text-neutral-100 outline-none focus:ring-2 focus:ring-primary-500/40"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {passwordError && (
                        <p className="text-xs text-rose-400 mt-1">{passwordError}</p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        loading={verifying}
                        onClick={handleVerifyPassword}
                        className="flex-1"
                      >
                        Tassykla
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setShowSettings(false);
                          setPassword('');
                          setPasswordError('');
                        }}
                      >
                        Ýapmak
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                // VPS Settings Panel
                <>
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <Server className="h-5 w-5 text-primary-400" />
                      VPS Gateway Baglanyşygy
                    </h2>
                    <button
                      onClick={() => {
                        setShowSettings(false);
                        setSettingsUnlocked(false);
                      }}
                      className="text-neutral-400 hover:text-white text-xs"
                    >
                      Ýapmak
                    </button>
                  </div>

                  {settingsMsg && (
                    <div className={`text-xs rounded-lg px-3 py-2 ${
                      settingsMsg.includes('Ýalňyşlyk')
                        ? 'text-rose-300 bg-rose-950/40 border border-rose-900/60'
                        : 'text-emerald-300 bg-emerald-950/40 border border-emerald-800/60'
                    }`}>
                      {settingsMsg}
                    </div>
                  )}

                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-neutral-400">Gateway URL</label>
                      <input
                        type="text"
                        value={gatewayUrl}
                        onChange={(e) => setGatewayUrl(e.target.value)}
                        placeholder="http://localhost:4000"
                        className="w-full h-10 rounded-xl border border-surface-border bg-surface-card px-3 text-sm text-neutral-100 outline-none focus:ring-2 focus:ring-primary-500/40"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-neutral-400">Admin Sync Secret</label>
                      <div className="relative">
                        <input
                          type={showSecret ? 'text' : 'password'}
                          value={adminSecret}
                          onChange={(e) => setAdminSecret(e.target.value)}
                          placeholder="GATEWAY_ADMIN_SECRET"
                          className="w-full h-10 rounded-xl border border-surface-border bg-surface-card px-3 pr-10 text-sm text-neutral-100 outline-none focus:ring-2 focus:ring-primary-500/40"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSecret((v) => !v)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500"
                        >
                          {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] px-2 py-0.5 rounded-md ${
                        health === 'online'
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : health === 'offline'
                            ? 'bg-rose-500/15 text-rose-300'
                            : 'bg-slate-700 text-slate-400'
                      }`}>
                        {health === 'online' ? 'Online' : health === 'offline' ? 'Offline' : '...'}
                      </span>
                      {gatewayUrl && (
                        <button
                          onClick={() => window.open(`${gatewayUrl.replace(/\/$/, '')}/health`, '_blank')}
                          className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Health açmak
                        </button>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        loading={savingSettings}
                        onClick={handleSaveSettings}
                        className="flex-1"
                      >
                        Sakla
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={handleTestHealth}
                        disabled={!gatewayUrl}
                      >
                        Barla
                      </Button>
                    </div>

                    <p className="text-[10px] text-neutral-500 text-center">
                      Bu sazlamalar diňe şu kompýuter üçin saklanýar. Electron we BI Platform üçin aýry sazlamalar gerek.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Simple Button component fallback
function Button({ children, onClick, disabled, loading, variant = 'primary', size = 'sm', className = '' }: any) {
  const base = 'inline-flex items-center justify-center gap-1.5 rounded-xl font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const variants: Record<string, string> = {
    primary: 'bg-primary-600 hover:bg-primary-500 text-white',
    secondary: 'bg-surface-border hover:bg-neutral-800 text-neutral-300',
  };
  const sizes: Record<string, string> = {
    sm: 'h-9 px-4',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`${base} ${variants[variant] || variants.primary} ${sizes[size] || sizes.sm} ${className}`}
    >
      {loading && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </button>
  );
}
