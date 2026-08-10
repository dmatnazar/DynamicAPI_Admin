import { useEffect, useState } from 'react';
import { RotateCcw, CloudUpload, Loader2, Wifi, WifiOff } from 'lucide-react';
import { manualSync, subscribeSyncStatus, type SyncStatusSnapshot } from '../lib/syncEngine';

function fmtTime(iso?: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '—';
  }
}

function fmtCountdown(iso?: string) {
  if (!iso) return '—';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'häzir';
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export function TitleBar() {
  const [status, setStatus] = useState<SyncStatusSnapshot | null>(null);
  const [tick, setTick] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => subscribeSyncStatus(setStatus), []);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const onSync = async () => {
    setMsg(null);
    const res = await manualSync();
    setMsg(res.message);
    setTimeout(() => setMsg(null), 4000);
  };

  void tick; // re-render countdown

  return (
    <div
      className="h-10 shrink-0 flex items-center justify-between pl-3 pr-1.5 bg-surface-raised border-b border-surface-border select-none"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <span className="text-[11px] font-medium tracking-wide text-neutral-500">
        Dynamic API Admin
      </span>

      <div
        className="flex items-center gap-2"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {/* Sync status pill */}
        <div className="hidden sm:flex items-center gap-2 rounded-lg border border-surface-border bg-surface-card/60 px-2.5 py-1 max-w-[340px]">
          {status?.online === true ? (
            <Wifi size={12} className="text-emerald-400 shrink-0" />
          ) : status?.online === false ? (
            <WifiOff size={12} className="text-amber-400 shrink-0" />
          ) : (
            <Wifi size={12} className="text-neutral-600 shrink-0" />
          )}
          <div className="min-w-0 text-[10px] leading-tight">
            <div className="text-neutral-300 truncate">
              {status?.running
                ? 'Sync edilýär...'
                : status?.lastError
                  ? `Queue: ${status.queueLength || 0} · ${status.lastError.slice(0, 40)}`
                  : status?.lastResult || 'Sync taýýar'}
            </div>
            <div className="text-neutral-500">
              soňky: {fmtTime(status?.lastSuccessAt)} · indiki:{' '}
              {status?.running ? '...' : fmtCountdown(status?.nextSyncAt)}
              {(status?.queueLength || 0) > 0 && (
                <span className="text-amber-400"> · queue {status?.queueLength}</span>
              )}
            </div>
          </div>
        </div>

        {msg && (
          <span className="text-[10px] text-indigo-300 max-w-[140px] truncate hidden md:inline">
            {msg}
          </span>
        )}

        <button
          title="VPS bilen sync"
          onClick={() => void onSync()}
          disabled={status?.running}
          className="h-8 px-2.5 flex items-center gap-1.5 text-[11px] text-neutral-300 hover:text-white hover:bg-indigo-500/20 border border-surface-border hover:border-indigo-500/40 rounded-lg transition disabled:opacity-50"
        >
          {status?.running ? (
            <Loader2 size={13} className="animate-spin text-indigo-400" />
          ) : (
            <CloudUpload size={13} className="text-indigo-400" />
          )}
          <span className="hidden xs:inline">Sync VPS</span>
        </button>

        <button
          title="Restart app"
          onClick={() => window.windowAPI.restartApp()}
          className="h-8 w-9 flex items-center justify-center text-neutral-500 hover:text-neutral-200 hover:bg-surface-card rounded transition"
        >
          <RotateCcw size={13} />
        </button>
      </div>
    </div>
  );
}
