import { useEffect, useState } from 'react';
import {
  Server,
  ShieldCheck,
  RefreshCw,
  Info,
  Eye,
  EyeOff,
  Lock,
  Cpu,
  HardDrive,
  Globe,
  Building2,
  Copy,
  Check,
  Shield,
  KeyRound,
  User,
  Power,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { checkGatewayHealth } from '../lib/api';
import { useDeviceStore } from '../store/useDeviceStore';

const SYNC_INTERVAL_OPTIONS = [
  { value: 15, label: 'Her 15 sekunt' },
  { value: 30, label: 'Her 30 sekunt' },
  { value: 60, label: 'Her 1 minut' },
  { value: 120, label: 'Her 2 minut' },
  { value: 300, label: 'Her 5 minut' },
  { value: 0, label: 'Diňe el bilen' },
];

export function SettingsPage() {
  const { profile, checkStatus: recheckDevice, checking: deviceChecking } = useDeviceStore();
  const [version, setVersion] = useState('');
  const [gatewayUrl, setGatewayUrl] = useState('http://localhost:4000');
  const [adminSecret, setAdminSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [autoSyncMinutes, setAutoSyncMinutes] = useState(0);
  const [savedSection, setSavedSection] = useState<'gateway' | 'sync' | 'update' | 'autostart' | null>(null);
  const [health, setHealth] = useState<'unknown' | 'checking' | 'online' | 'offline'>('unknown');
  const [copiedId, setCopiedId] = useState(false);
  const [autoLaunch, setAutoLaunch] = useState(false);
  const [autoLogin, setAutoLogin] = useState(false);
  const [autoLoginUsername, setAutoLoginUsername] = useState('');
  const [autoLoginPassword, setAutoLoginPassword] = useState('');
  const [showAutoPassword, setShowAutoPassword] = useState(false);
  const [syncEnabled, setSyncEnabled] = useState(false);

  // Auto-update structured configuration
  const [upProtocol, setUpProtocol] = useState<'http' | 'https'>('https');
  const [upHost, setUpHost] = useState('216.250.13.39');
  const [upPort, setUpPort] = useState('');
  const [upPath, setUpPath] = useState('/updates');
  const [upUsername, setUpUsername] = useState('');
  const [upPassword, setUpPassword] = useState('');
  const [showUpPassword, setShowUpPassword] = useState(false);
  const [feedMsg, setFeedMsg] = useState<string | null>(null);
  const [feedChecking, setFeedChecking] = useState(false);

  useEffect(() => {
    window.appAPI?.getVersion?.().then(setVersion);
    window.vaultAPI?.get('gatewayUrl').then((v: string | null) => v && setGatewayUrl(v));
    window.vaultAPI?.get('adminSyncSecret').then((v: string | null) => v && setAdminSecret(v));
    window.vaultAPI?.get('autoSyncSeconds').then((v: string | null) => {
      if (v) setAutoSyncMinutes(Number(v));
      else window.vaultAPI?.get('autoSyncMinutes').then((m: string | null) => m && setAutoSyncMinutes(Number(m)));
    });
    window.appAPI?.getAutoLaunch?.().then((v: boolean) => setAutoLaunch(v));
    window.vaultAPI?.get('autoLoginEnabled').then((v: string | null) => setAutoLogin(v === '1'));
    window.vaultAPI?.get('autoLoginUsername').then((v: string | null) => v && setAutoLoginUsername(v));
    window.vaultAPI?.get('autoLoginPassword').then((v: string | null) => v && setAutoLoginPassword(v));
    window.vaultAPI?.get('syncEnabled').then((v: string | null) => setSyncEnabled(v === '1' || v === 'true'));
    window.dbAPI?.getSyncMeta?.().then((m: any) => {
      if (m?.autoSyncIntervalSec) setAutoSyncMinutes(m.autoSyncIntervalSec);
    });

    // Load structured update feed config
    if ((window as any).updaterAPI?.getConfig) {
      (window as any).updaterAPI.getConfig().then((cfg: any) => {
        if (cfg) {
          setUpProtocol(cfg.protocol || 'https');
          setUpHost(cfg.host || '216.250.13.39');
          setUpPort(cfg.port ? String(cfg.port) : '');
          setUpPath(cfg.path || '/updates');
          setUpUsername(cfg.username || '');
          setUpPassword(cfg.password || '');
        }
      });
    }
  }, []);

  const handleCopyId = () => {
    if (!profile?.id) return;
    navigator.clipboard.writeText(profile.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const saveUpdateConfig = async () => {
    setFeedMsg(null);
    try {
      if ((window as any).updaterAPI?.saveConfig) {
        const res = await (window as any).updaterAPI.saveConfig({
          protocol: upProtocol,
          host: upHost.trim(),
          port: upPort.trim(),
          path: upPath.trim(),
          username: upUsername.trim(),
          password: upPassword,
        });
        if (res?.ok) {
          setFeedMsg(`Sazlamalar saklandy: ${res.url}`);
          setSavedSection('update');
          setTimeout(() => {
            setSavedSection(null);
            setFeedMsg(null);
          }, 3500);
        } else {
          setFeedMsg('Ýalňyşlyk: URL düzülmedi');
        }
      }
    } catch (e: any) {
      setFeedMsg(e?.message || 'Ýalňyşlyk ýüze çykdy');
    }
  };

  const checkUpdatesNow = async () => {
    setFeedChecking(true);
    setFeedMsg('VPS barlanýar…');
    try {
      const r = await window.updaterAPI.check();
      if (r && typeof r === 'object' && 'ok' in r && !(r as { ok?: boolean }).ok) {
        setFeedMsg((r as { message?: string }).message || 'Update tapylmady ýa-da baglanyşyk ýalňyş');
      } else {
        setFeedMsg('Barlag tamamlandy (täze wersiýa bar bolsa täzelener)');
      }
    } catch {
      setFeedMsg('VPS-e birigip bolmady');
    } finally {
      setFeedChecking(false);
      setTimeout(() => setFeedMsg(null), 4000);
    }
  };

  const saveGateway = async () => {
    const cleanUrl = gatewayUrl.trim().replace(/\/$/, '');
    await window.vaultAPI.set('gatewayUrl', cleanUrl);
    await window.vaultAPI.set('adminSyncSecret', adminSecret.trim());
    await window.dbAPI?.updateSettings?.({
      gatewayUrl: cleanUrl,
      adminSecret: adminSecret.trim(),
    });
    setSavedSection('gateway');
    setTimeout(() => setSavedSection(null), 2000);
  };

  const testHealth = async () => {
    setHealth('checking');
    const ok = await checkGatewayHealth(gatewayUrl);
    setHealth(ok ? 'online' : 'offline');
  };

  const saveSync = async () => {
    await window.vaultAPI.set('autoSyncSeconds', String(autoSyncMinutes));
    await window.dbAPI?.updateSyncMeta?.({
      autoSyncIntervalSec: autoSyncMinutes,
    });
    setSavedSection('sync');
    setTimeout(() => setSavedSection(null), 2000);
  };

  const toggleSync = async () => {
    const newValue = !syncEnabled;
    await window.vaultAPI.set('syncEnabled', newValue ? '1' : '0');
    setSyncEnabled(newValue);
    if (newValue) {
      await window.dbAPI?.enqueueSync?.({ type: 'full-sync' });
      await window.dbAPI?.updateSyncMeta?.({
        autoSyncIntervalSec: autoSyncMinutes,
      });
    }
    setSavedSection('sync');
    setTimeout(() => setSavedSection(null), 2000);
  };

  const saveAutostart = async () => {
    await window.appAPI?.setAutoLaunch?.(autoLaunch);
    setSavedSection('autostart');
    setTimeout(() => setSavedSection(null), 2000);
  };

  const saveAutoLogin = async () => {
    await window.vaultAPI.set('autoLoginEnabled', autoLogin ? '1' : '0');
    if (autoLogin) {
      await window.vaultAPI.set('autoLoginUsername', autoLoginUsername.trim());
      await window.vaultAPI.set('autoLoginPassword', autoLoginPassword);
    } else {
      await window.vaultAPI.delete('autoLoginUsername');
      await window.vaultAPI.delete('autoLoginPassword');
    }
    setSavedSection('autostart');
    setTimeout(() => setSavedSection(null), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold tracking-tight text-neutral-100 flex items-center gap-2">
          <Server className="h-5 w-5 text-primary-400" />
          Sazlamalar & Enjam Maglumatlary
        </h2>
        <p className="text-xs text-neutral-500 mt-0.5">
          Programmanyň VPS Gateway, MSSQL baglanyşyklary we awtomatiki täzelenme sazlamalary.
        </p>
      </div>

      {/* Device Hardware Profile Card */}
      <section className="rounded-xl border border-primary-500/30 bg-surface-card p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-emerald-400" />
            <h3 className="text-sm font-semibold text-neutral-100">Enjam Maglumatlary (Device Profile)</h3>
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-800/80 text-[11px] font-medium text-emerald-300">
            <Shield size={12} />
            {profile?.status === 'approved' ? 'Tassyklanan (Active)' : profile?.status || 'Garaşylýar'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-surface-raised border border-surface-border space-y-1.5 font-mono">
            <div className="flex items-center justify-between">
              <span className="text-neutral-400">Device ID:</span>
              <button
                onClick={handleCopyId}
                className="text-primary-400 hover:text-primary-300 flex items-center gap-1"
                title="Göçürmek"
              >
                {profile?.id || '—'}
                {copiedId ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-400">Host:</span>
              <span className="text-neutral-200">{profile?.hostname || '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-400">Firma:</span>
              <span className="text-primary-300 font-semibold">{profile?.companyName || profile?.tenantSlug || 'Hemme firmalar'}</span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-surface-raised border border-surface-border space-y-1.5 font-mono">
            <div className="flex items-center justify-between">
              <span className="text-neutral-400">OS:</span>
              <span className="text-neutral-200">{profile?.osPlatform} {profile?.osRelease}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-400">RAM:</span>
              <span className="text-neutral-200">{profile?.ramGb ? `${profile.ramGb} GB` : '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-400">IP:</span>
              <span className="text-neutral-200">{profile?.ipAddress || '—'}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            variant="secondary"
            onClick={() => void recheckDevice()}
            disabled={deviceChecking}
            className="text-xs flex items-center gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${deviceChecking ? 'animate-spin' : ''}`} />
            Enjamy Täzeden Barlamak
          </Button>
        </div>
      </section>

      {/* Gateway connection */}
      <section className="rounded-xl border border-indigo-500/20 bg-gradient-to-br from-surface-card to-surface-raised p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <Server size={16} className="text-indigo-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-100">VPS Gateway Baglanyşygy</h3>
              <p className="text-[10px] text-neutral-500">Sync we authentication üçin merkezi serwer</p>
            </div>
          </div>
          {health !== 'unknown' && (
            <Badge
              status={health === 'online' ? 'success' : health === 'checking' ? 'testing' : 'failed'}
              label={health === 'checking' ? 'Barlanýar…' : health === 'online' ? 'Online' : 'Offline'}
            />
          )}
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs text-neutral-400 font-medium">VPS Gateway URL</label>
            <div className="relative">
              <input
                className="w-full bg-surface-raised border border-surface-border rounded-lg px-3 py-2.5 text-sm font-mono pl-9 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                value={gatewayUrl}
                onChange={(e) => setGatewayUrl(e.target.value)}
                placeholder="https://your-domain.com ýa-da http://216.250.13.39:4000"
              />
              <Globe className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
              <button
                type="button"
                onClick={() => { navigator.clipboard.writeText(gatewayUrl); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 p-1 rounded hover:bg-surface-border/50 transition-colors"
                title="Göçürmek"
              >
                <Copy size={14} />
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-neutral-400 font-medium">Ýerli master parol (islege görä)</label>
            <p className="text-[10px] text-neutral-500">BI/VPS ADMIN_SYNC_SECRET däl. Electron sync diňe device_sync_secret bilen işlenýär.</p>
            <div className="relative">
              <input
                type={showSecret ? 'text' : 'password'}
                className="w-full bg-surface-raised border border-surface-border rounded-lg px-3 py-2.5 pr-10 text-sm font-mono focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                value={adminSecret}
                onChange={(e) => setAdminSecret(e.target.value)}
                placeholder="VPS .env faýlyndaky ADMIN_SYNC_SECRET"
              />
              <button
                type="button"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 p-1 rounded hover:bg-surface-border/50 transition-colors"
                onClick={() => setShowSecret((v) => !v)}
              >
                {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <p className="text-[10px] text-neutral-500">
              Bu gizlin söz diňe şu kompýuterde saklanýar we VPS bilen sync üçin ulanylýar.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <Button variant="secondary" onClick={testHealth} disabled={health === 'checking'} className="gap-1.5">
            {health === 'checking' ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
            {health === 'checking' ? 'Barlanýar...' : 'Statusy Barla'}
          </Button>
          <Button onClick={saveGateway} className="gap-1.5">
            {savedSection === 'gateway' ? <><Check className="h-3.5 w-3.5" /> Saklandy ✓</> : 'Ýatda Sakla'}
          </Button>
        </div>
      </section>

      {/* Auto-update feed with VPS Credentials */}
      <section className="rounded-xl border border-surface-border bg-surface-card p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RefreshCw size={16} className="text-sky-400" />
            <h3 className="text-sm font-semibold text-neutral-100">Awtomatiki Täzelenme (VPS Auto-Update)</h3>
          </div>
          <span className="text-xs text-neutral-500 font-mono">v{version || '1.0.0'}</span>
        </div>

        <p className="text-xs text-neutral-400">
          Programma açylanda we her 4 sagatda VPS serwerinden täze wersiýany barlar we awtomatiki täzelär.
        </p>

        <div className="space-y-3">
          {/* Protocol, Host, Port */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            <div className="sm:col-span-3 space-y-1">
              <label className="text-xs text-neutral-400">Protokol:</label>
              <select
                className="w-full bg-surface-raised border border-surface-border rounded-lg px-2.5 py-2 text-sm text-white font-mono focus:outline-none focus:border-primary-500"
                value={upProtocol}
                onChange={(e) => setUpProtocol(e.target.value as any)}
              >
                <option value="https">HTTPS</option>
                <option value="http">HTTP</option>
              </select>
            </div>

            <div className="sm:col-span-6 space-y-1">
              <label className="text-xs text-neutral-400">VPS IP / Domen:</label>
              <input
                type="text"
                className="w-full bg-surface-raised border border-surface-border rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-primary-500"
                value={upHost}
                onChange={(e) => setUpHost(e.target.value)}
                placeholder="216.250.13.39 ýa-da api.domain.com"
              />
            </div>

            <div className="sm:col-span-3 space-y-1">
              <label className="text-xs text-neutral-400">Port (Islege görä):</label>
              <input
                type="text"
                className="w-full bg-surface-raised border border-surface-border rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-primary-500"
                value={upPort}
                onChange={(e) => setUpPort(e.target.value)}
                placeholder="mysal: 443"
              />
            </div>
          </div>

          {/* Path */}
          <div className="space-y-1">
            <label className="text-xs text-neutral-400">Papka Ýoly (Path):</label>
            <input
              type="text"
              className="w-full bg-surface-raised border border-surface-border rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-primary-500"
              value={upPath}
              onChange={(e) => setUpPath(e.target.value)}
              placeholder="/updates"
            />
          </div>

          {/* VPS Auth Credentials */}
          <div className="p-3.5 rounded-xl bg-surface-raised/70 border border-surface-border space-y-3">
            <p className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
              <KeyRound size={13} className="text-primary-400" />
              VPS (Ubuntu) Hasap Giriş Maglumatlary (Goragly Feed üçin):
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] text-neutral-400">VPS Login (Username):</label>
                <div className="relative">
                  <User className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-500" />
                  <input
                    type="text"
                    className="w-full bg-surface-card border border-surface-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-white"
                    value={upUsername}
                    onChange={(e) => setUpUsername(e.target.value)}
                    placeholder="Islege görä"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-neutral-400">VPS Parol:</label>
                <div className="relative">
                  <KeyRound className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-500" />
                  <input
                    type={showUpPassword ? 'text' : 'password'}
                    className="w-full bg-surface-card border border-surface-border rounded-lg pl-8 pr-8 py-1.5 text-xs text-white"
                    value={upPassword}
                    onChange={(e) => setUpPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-2 text-neutral-500"
                    onClick={() => setShowUpPassword((v) => !v)}
                  >
                    {showUpPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {feedMsg && <p className="text-xs text-amber-400 font-mono">{feedMsg}</p>}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <Button
            variant="secondary"
            onClick={checkUpdatesNow}
            disabled={feedChecking}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${feedChecking ? 'animate-spin' : ''}`} />
            {feedChecking ? 'Barlanýar...' : 'Häzir Update Barla'}
          </Button>

          <Button onClick={saveUpdateConfig}>
            {savedSection === 'update' ? 'Saklandy ✓' : 'Update Sazlamasyny Ýatda Sakla'}
          </Button>
        </div>
      </section>

      {/* Sync settings */}
      <section className="rounded-xl border border-surface-border bg-surface-card p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RefreshCw size={16} className="text-emerald-400" />
            <h3 className="text-sm font-semibold text-neutral-100">Awtomatiki Sinhronizasiýa</h3>
          </div>
          <button
            onClick={toggleSync}
            className={`h-7 w-11 rounded-full transition-colors relative shrink-0 ${
              syncEnabled ? 'bg-emerald-600' : 'bg-slate-700'
            }`}
          >
            <span
              className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform"
              style={{ left: syncEnabled ? 'calc(100% - 1.625rem)' : '0.125rem' }}
            />
          </button>
        </div>

        {syncEnabled && (
          <div className="space-y-1.5">
            <label className="text-xs text-neutral-400">Sinhronizasiýa wagty</label>
            <select
              className="w-full bg-surface-raised border border-surface-border rounded-md px-3 py-2 text-sm text-white"
              value={autoSyncMinutes}
              onChange={(e) => setAutoSyncMinutes(Number(e.target.value))}
            >
              {SYNC_INTERVAL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-neutral-500">
              Offline wagty üýtgeşmeler ýerli SQLite bazasynda saklanýar we internet açylanda awtomatiki sinhronlanýar.
            </p>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <Button onClick={saveSync} disabled={!syncEnabled}>
            {savedSection === 'sync' ? 'Saklandy ✓' : 'Ýatda Sakla'}
          </Button>
        </div>
      </section>

      {/* Autostart + Auto-login */}
      <section className="rounded-xl border border-surface-border bg-surface-card p-3 sm:p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Power size={14} className="text-amber-400" />
          <h3 className="text-xs font-semibold text-neutral-100 uppercase tracking-wider">Başlatma we Giriş</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Autostart */}
          <div className="p-3 rounded-lg bg-surface-raised border border-surface-border space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-neutral-200">Awtomatik Başlatma</p>
                <p className="text-[10px] text-neutral-500">Windows açylanda</p>
              </div>
              <button
                onClick={() => setAutoLaunch((v) => !v)}
                className={`h-7 w-11 rounded-full transition-colors relative shrink-0 ${
                  autoLaunch ? 'bg-emerald-600' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                    autoLaunch ? 'translate-x-5.5 left-0.5' : 'translate-x-0.5 left-0.5'
                  }`}
                  style={{ left: autoLaunch ? 'calc(100% - 1.625rem)' : '0.125rem' }}
                />
              </button>
            </div>
            <p className="text-[10px] text-neutral-500">Tray-da gizli rejimde açylar</p>
          </div>

          {/* Auto-login */}
          <div className="p-3 rounded-lg bg-surface-raised border border-surface-border space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-neutral-200">Awtomatik Giriş</p>
                <p className="text-[10px] text-neutral-500">Restart soň</p>
              </div>
              <button
                onClick={() => setAutoLogin((v) => !v)}
                className={`h-7 w-11 rounded-full transition-colors relative shrink-0 ${
                  autoLogin ? 'bg-indigo-600' : 'bg-slate-700'
                }`}
              >
                <span
                  className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform"
                  style={{ left: autoLogin ? 'calc(100% - 1.625rem)' : '0.125rem' }}
                />
              </button>
            </div>
            {autoLogin && (
              <div className="space-y-1.5 pt-1">
                <input
                  className="w-full bg-surface-card border border-surface-border rounded px-2 py-1 text-xs text-white"
                  value={autoLoginUsername}
                  onChange={(e) => setAutoLoginUsername(e.target.value)}
                  placeholder="Ulanyjy"
                />
                <div className="relative">
                  <input
                    type={showAutoPassword ? 'text' : 'password'}
                    className="w-full bg-surface-card border border-surface-border rounded px-2 py-1 pr-7 text-xs text-white"
                    value={autoLoginPassword}
                    onChange={(e) => setAutoLoginPassword(e.target.value)}
                    placeholder="Parol"
                  />
                  <button
                    type="button"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-neutral-500"
                    onClick={() => setShowAutoPassword((v) => !v)}
                  >
                    {showAutoPassword ? <EyeOff size={12} /> : <Eye size={12} />}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <Button size="sm" onClick={saveAutostart}>
            {savedSection === 'autostart' ? 'Saklandy ✓' : 'Ýatda Sakla'}
          </Button>
        </div>
      </section>
    </div>
  );
}
