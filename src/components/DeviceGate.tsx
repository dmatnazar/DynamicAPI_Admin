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
} from 'lucide-react';
import { useDeviceStore } from '../store/useDeviceStore';

interface Props {
  children: React.ReactNode;
}

export function DeviceGate({ children }: Props) {
  const { profile, loading, checking, error, fetchProfile, checkStatus, registerDevice } =
    useDeviceStore();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchProfile().then((p) => {
      if (p && p.status !== 'approved') {
        registerDevice();
      }
    });
  }, [fetchProfile, registerDevice]);

  // Auto poll status if pending
  useEffect(() => {
    if (!profile || profile.status === 'approved') return;
    const timer = setInterval(() => {
      checkStatus();
    }, 6000);
    return () => clearInterval(timer);
  }, [profile, checkStatus]);

  const handleCopyId = () => {
    if (!profile?.id) return;
    navigator.clipboard.writeText(profile.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
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

  // If blocked
  if (profile?.status === 'blocked') {
    return (
      <div className="h-screen w-screen bg-[#0A0B0F] flex items-center justify-center p-6 select-none">
        <div className="max-w-md w-full bg-surface-raised border border-rose-900/60 rounded-2xl p-8 shadow-2xl text-center space-y-5 animate-in fade-in">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-rose-950/80 border border-rose-800/80 flex items-center justify-center text-rose-400">
            <Ban className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Bu Enjam Petiklenen</h1>
            <p className="text-sm text-neutral-400 mt-2">
              Bu kompýuterdäki programma administrator tarapyndan petiklendi. Maglumat sinhronizasiýasy we baza baglanyşygy togtadyldy.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-surface-card border border-surface-border text-left text-xs space-y-1.5 font-mono text-neutral-400">
            <div><span className="text-neutral-500">Device ID:</span> {profile.id}</div>
            <div><span className="text-neutral-500">Host:</span> {profile.hostname}</div>
            <div><span className="text-neutral-500">Firma:</span> {profile.companyName || profile.tenantSlug || '—'}</div>
          </div>

          <button
            onClick={() => checkStatus()}
            disabled={checking}
            className="w-full py-2.5 px-4 rounded-xl bg-surface-border hover:bg-neutral-800 text-white font-medium text-sm transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
            Ýagdaýy Täzeden Barlamak
          </button>
        </div>
      </div>
    );
  }

  // If pending approval
  return (
    <div className="h-screen w-screen bg-[#0A0B0F] flex items-center justify-center p-6 select-none">
      <div className="max-w-lg w-full bg-surface-raised border border-surface-border rounded-2xl p-8 shadow-2xl space-y-6 animate-in fade-in">
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

        {/* Device specs card */}
        <div className="rounded-xl bg-surface-card border border-surface-border p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-surface-border/60 pb-2.5">
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
              Enjam Maglumatlary
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-950/80 border border-amber-800/80 text-[11px] font-medium text-amber-300">
              <AlertTriangle className="h-3 w-3" />
              Tassyklanmadyk
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between bg-surface-raised/80 p-2 rounded-lg">
              <span className="text-neutral-400 font-mono">Device ID:</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-white font-medium select-all">
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

        {error && (
          <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-900/60 text-xs text-rose-300 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Refresh button */}
        <div className="space-y-2">
          <button
            onClick={() => checkStatus()}
            disabled={checking}
            className="w-full py-2.5 px-4 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-semibold text-sm transition-all shadow-lg shadow-primary-950/50 flex items-center justify-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
            {checking ? 'Barlanýar...' : 'Ýagdaýy Täzeden Barlamak'}
          </button>
          <p className="text-[11px] text-center text-neutral-500">
            Admin tassyklan dessine programma awtomatiki açylar (her 6 sekuntdan barlanýar).
          </p>
        </div>
      </div>
    </div>
  );
}
