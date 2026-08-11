import { useEffect, useState } from 'react';
import { Server, ShieldCheck, RefreshCw, Info, Eye, EyeOff, Lock } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { checkGatewayHealth } from '../lib/api';

const SYNC_INTERVAL_OPTIONS = [
  { value: 15, label: 'Her 15 sekunt' },
  { value: 30, label: 'Her 30 sekunt' },
  { value: 60, label: 'Her 1 minut' },
  { value: 120, label: 'Her 2 minut' },
  { value: 300, label: 'Her 5 minut' },
  { value: 0, label: 'Diňe el bilen' },
];

export function SettingsPage() {
  const [version, setVersion] = useState('');
  const [gatewayUrl, setGatewayUrl] = useState('http://localhost:4000');
  const [adminSecret, setAdminSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [autoSyncMinutes, setAutoSyncMinutes] = useState(0);
  const [savedSection, setSavedSection] = useState<'gateway' | 'sync' | null>(null);
  const [health, setHealth] = useState<'unknown' | 'checking' | 'online' | 'offline'>('unknown');
  const [lockHas, setLockHas] = useState(false);
  const [lockPassword, setLockPassword] = useState('');
  const [lockPassword2, setLockPassword2] = useState('');
  const [lockMsg, setLockMsg] = useState<string | null>(null);
  const [showLock, setShowLock] = useState(false);
  const [updateFeedUrl, setUpdateFeedUrl] = useState('');
  const [feedMsg, setFeedMsg] = useState<string | null>(null);

  useEffect(() => {
    window.appAPI.getVersion().then(setVersion);
    window.vaultAPI.get('gatewayUrl').then((v) => v && setGatewayUrl(v));
    window.vaultAPI.get('adminSyncSecret').then((v) => v && setAdminSecret(v));
    window.vaultAPI.get('autoSyncSeconds').then((v) => {
      if (v) setAutoSyncMinutes(Number(v));
      else window.vaultAPI.get('autoSyncMinutes').then((m) => m && setAutoSyncMinutes(Number(m)));
    });
    window.dbAPI?.getSyncMeta?.().then((m) => {
      if (m?.autoSyncIntervalSec) setAutoSyncMinutes(m.autoSyncIntervalSec);
    });
    window.appLockAPI?.hasPassword?.().then((h) => setLockHas(!!h));
    window.updaterAPI?.getFeedUrl?.().then((u) => u && setUpdateFeedUrl(u));
  }, []);

  const saveFeedUrl = async () => {
    setFeedMsg(null);
    const r = await window.updaterAPI.setFeedUrl(updateFeedUrl.trim());
    if (r?.ok) {
      setFeedMsg('Update URL saklandy');
      setTimeout(() => setFeedMsg(null), 2000);
    } else {
      setFeedMsg(r?.message || 'Ýalňyşlyk');
    }
  };

  const checkUpdatesNow = async () => {
    setFeedMsg('Barlanýar…');
    const r = await window.updaterAPI.check();
    if (r && typeof r === 'object' && 'ok' in r && !(r as { ok?: boolean }).ok) {
      setFeedMsg((r as { message?: string }).message || 'Update ýok ýa-da baglanyşyk ýalňyş');
    } else {
      setFeedMsg('Barlag tamamlandy (täze wersiýa bar bolsa bildiriş çykýar)');
      setTimeout(() => setFeedMsg(null), 3000);
    }
  };


  const saveAppLock = async () => {
    setLockMsg(null);
    if (lockPassword.length < 4) {
      setLockMsg('Parol azyndan 4 simwol bolmaly');
      return;
    }
    if (lockPassword !== lockPassword2) {
      setLockMsg('Parollar gabat gelenok');
      return;
    }
    try {
      await window.appLockAPI.setPassword(lockPassword);
      setLockHas(true);
      setLockPassword('');
      setLockPassword2('');
      setLockMsg('Parol saklandy');
      setTimeout(() => setLockMsg(null), 2000);
    } catch (e) {
      setLockMsg(e instanceof Error ? e.message : 'Ýalňyşlyk');
    }
  };

  const clearAppLock = async () => {
    await window.appLockAPI.clearPassword();
    setLockHas(false);
    setLockMsg('Parol aýryldy — indiki açylyşda ähli funksiýalar açyk');
    setTimeout(() => setLockMsg(null), 3000);
  };


  const saveGateway = async () => {
    await window.vaultAPI.set('gatewayUrl', gatewayUrl);
    await window.vaultAPI.set('adminSyncSecret', adminSecret);
    setSavedSection('gateway');
    setTimeout(() => setSavedSection(null), 1500);
  };

  const saveSync = async () => {
    // value is seconds (label still uses minutes historically)
    const sec = Number(autoSyncMinutes) || 30;
    await window.vaultAPI.set('autoSyncSeconds', String(sec));
    await window.vaultAPI.set('autoSyncMinutes', String(sec)); // legacy key
    await window.dbAPI?.updateSyncMeta?.({ autoSyncIntervalSec: sec || 30 });
    // notify sync engine
    window.dispatchEvent(new CustomEvent('sync-interval-changed', { detail: { sec } }));
    setSavedSection('sync');
    setTimeout(() => setSavedSection(null), 1500);
  };

  const testGateway = async () => {
    setHealth('checking');
    const ok = await checkGatewayHealth(gatewayUrl);
    setHealth(ok ? 'online' : 'offline');
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold text-neutral-100">Settings</h2>
        <p className="text-xs text-neutral-500 mt-0.5">Manage how this admin app talks to your VPS Gateway.</p>
      </div>

      {/* VPS Gateway connection */}
      <section className="rounded-xl border border-surface-border bg-surface-card p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Server size={16} className="text-accent" />
          <h3 className="text-sm font-semibold text-neutral-100">VPS Gateway connection</h3>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-neutral-400">Gateway URL</label>
          <input
            className="w-full bg-surface-raised border border-surface-border rounded-md px-3 py-2 text-sm font-mono"
            value={gatewayUrl}
            onChange={(e) => setGatewayUrl(e.target.value)}
            placeholder="http://localhost:4000"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-neutral-400 flex items-center gap-1.5">
            <ShieldCheck size={12} /> Admin sync secret
          </label>
          <div className="relative">
            <input
              type={showSecret ? 'text' : 'password'}
              className="w-full bg-surface-raised border border-surface-border rounded-md px-3 py-2 pr-9 text-sm font-mono"
              value={adminSecret}
              onChange={(e) => setAdminSecret(e.target.value)}
              placeholder="Must match ADMIN_SYNC_SECRET on the gateway's .env"
            />
            <button
              type="button"
              onClick={() => setShowSecret((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-200"
            >
              {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <p className="text-[11px] text-neutral-600 flex items-start gap-1">
            <Info size={12} className="mt-0.5 shrink-0" />
            Stored encrypted on this device via the OS keychain — never synced anywhere.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button variant="secondary" onClick={testGateway}>
            {health === 'checking' ? 'Checking…' : 'Test connection'}
          </Button>
          {health !== 'unknown' && health !== 'checking' && (
            <Badge status={health === 'online' ? 'success' : 'failed'} label={health === 'online' ? 'Online' : 'Offline'} />
          )}
          <div className="flex-1" />
          <Button onClick={saveGateway}>{savedSection === 'gateway' ? 'Saved ✓' : 'Save'}</Button>
        </div>
      </section>

      {/* Sync behaviour */}
      <section className="rounded-xl border border-surface-border bg-surface-card p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2">
          <RefreshCw size={16} className="text-accent" />
          <h3 className="text-sm font-semibold text-neutral-100">Sync behaviour</h3>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-neutral-400">Awto-sync aralygy</label>
          <select
            className="w-full bg-surface-raised border border-surface-border rounded-md px-3 py-2 text-sm"
            value={autoSyncMinutes}
            onChange={(e) => setAutoSyncMinutes(Number(e.target.value))}
          >
            {SYNC_INTERVAL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-neutral-600">
            When offline, changes are queued locally and pushed automatically once the gateway is reachable again.
          </p>
        </div>

        <div className="flex justify-end pt-1">
          <Button onClick={saveSync}>{savedSection === 'sync' ? 'Saved ✓' : 'Save'}</Button>
        </div>
      </section>



      {/* Auto-update feed */}
      <section className="rounded-xl border border-surface-border bg-surface-card p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2">
          <RefreshCw size={16} className="text-sky-400" />
          <h3 className="text-sm font-semibold text-neutral-100">Auto-update (VPS)</h3>
        </div>
        <p className="text-xs text-neutral-500">
          Programma açylanda we her 4 sagatda şu URL-den täze wersiýa gözlenýär.
          VPS-de <span className="font-mono text-neutral-400">/updates/latest.yml</span> we installer .exe bolmaly.
        </p>
        <div className="space-y-1.5">
          <label className="text-xs text-neutral-400">Update feed URL</label>
          <input
            className="w-full bg-surface-raised border border-surface-border rounded-md px-3 py-2 text-sm font-mono"
            value={updateFeedUrl}
            onChange={(e) => setUpdateFeedUrl(e.target.value)}
            placeholder="https://your-domain.com/updates"
          />
        </div>
        {feedMsg && <p className="text-xs text-amber-400">{feedMsg}</p>}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void saveFeedUrl()}>URL sakla</Button>
          <Button variant="secondary" onClick={() => void checkUpdatesNow()}>
            Häzir barla
          </Button>
        </div>
      </section>

      {/* App unlock password */}
      <section className="rounded-xl border border-surface-border bg-surface-card p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Lock size={16} className="text-indigo-400" />
          <h3 className="text-sm font-semibold text-neutral-100">App giriş paroly</h3>
        </div>
        <p className="text-xs text-neutral-500">
          Parol dogry bolsa ähli menýu açylýar. Parolsyz ýa-da nädogry bolsa diňe Dashboard görünýär.
          Häzir: {lockHas ? 'parol goýlan' : 'parol ýok (ähli zat açyk)'}.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs text-neutral-400">Täze parol</label>
            <div className="relative">
              <input
                type={showLock ? 'text' : 'password'}
                className="w-full bg-surface-raised border border-surface-border rounded-md px-3 py-2 pr-9 text-sm"
                value={lockPassword}
                onChange={(e) => setLockPassword(e.target.value)}
                placeholder="••••••••"
              />
              <button
                type="button"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500"
                onClick={() => setShowLock((v) => !v)}
              >
                {showLock ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-neutral-400">Täzeden ýaz</label>
            <input
              type={showLock ? 'text' : 'password'}
              className="w-full bg-surface-raised border border-surface-border rounded-md px-3 py-2 text-sm"
              value={lockPassword2}
              onChange={(e) => setLockPassword2(e.target.value)}
              placeholder="••••••••"
            />
          </div>
        </div>
        {lockMsg && <p className="text-xs text-amber-400">{lockMsg}</p>}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void saveAppLock()}>Paroly sakla</Button>
          {lockHas && (
            <Button variant="danger" onClick={() => void clearAppLock()}>
              Paroly aýyr
            </Button>
          )}
        </div>
      </section>

      <div className="pt-2 border-t border-surface-border flex items-center justify-between">
        <p className="text-xs text-neutral-500">App version: {version || '—'}</p>
      </div>
    </div>
  );
}
