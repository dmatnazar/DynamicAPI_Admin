import { useState } from 'react';
import { Copy, Check, ExternalLink, RefreshCw, CloudUpload } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { syncToVps, checkGatewayHealth } from '../../lib/api';
import { buildApiUrl, copyText } from '../../lib/apiUrl';
import { hasPrimaryConnection } from '../../types/endpoint.types';
import type { TenantConfig, EndpointConfig } from '../../types/endpoint.types';

interface Props {
  open: boolean;
  onClose: () => void;
  gatewayUrl: string;
  adminSecret: string;
  tenant: TenantConfig;
  endpoints: EndpointConfig[];
}

const METHOD_COLORS: Record<string, string> = {
  GET: 'text-emerald-400',
  POST: 'text-sky-400',
  PUT: 'text-amber-400',
  DELETE: 'text-red-400',
};

export function SyncGatewayModal({
  open,
  onClose,
  gatewayUrl,
  adminSecret,
  tenant,
  endpoints,
}: Props) {
  const [state, setState] = useState<'idle' | 'syncing' | 'success' | 'failed'>('idle');
  const [message, setMessage] = useState('');
  const [health, setHealth] = useState<boolean | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!open) return null;

  const hasConn = hasPrimaryConnection(tenant);
  const primary = tenant.connections.find((c) => c.isPrimary) ?? tenant.connections[0];

  const handleHealth = async () => {
    setHealth(await checkGatewayHealth(gatewayUrl));
  };

  const handleSync = async () => {
    setState('syncing');
    setMessage('');
    try {
      const result = await syncToVps(gatewayUrl, adminSecret, tenant, endpoints, true);
      setMessage(`${result.endpointsLoaded} endpoint synced · ${new Date(result.syncedAt).toLocaleString()}`);
      setState('success');
    } catch (err) {
      setMessage((err as Error).message);
      setState('failed');
    }
  };

  const handleCopy = async (ep: EndpointConfig) => {
    const url = buildApiUrl(gatewayUrl, tenant, ep);
    if (await copyText(url)) {
      setCopiedId(ep.id);
      setTimeout(() => setCopiedId(null), 1500);
    }
  };

  return (
    <Modal title="Sync to VPS Gateway" onClose={onClose} widthClass="max-w-2xl">
      <div className="space-y-4">
        {/* Meta */}
        <div className="rounded-lg border border-surface-border bg-surface-card/50 p-3 space-y-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-neutral-500">Target: </span>
              <span className="font-mono text-neutral-200">{gatewayUrl}</span>
            </div>
            <div className="flex items-center gap-2">
              {health === true && <span className="text-emerald-400">● online</span>}
              {health === false && <span className="text-red-400">● offline</span>}
              <Button variant="ghost" className="!text-[11px] !px-2 !py-1" onClick={() => void handleHealth()}>
                <RefreshCw size={11} className="inline mr-1" />
                Health
              </Button>
            </div>
          </div>
          <div>
            <span className="text-neutral-500">Kompaniýa: </span>
            <span className="text-neutral-200">{tenant.name}</span>
            <span className="font-mono text-neutral-500 ml-2">/{tenant.slug}</span>
          </div>
          {hasConn && primary ? (
            <div>
              <span className="text-neutral-500">Primary DB: </span>
              <span className="font-mono text-neutral-300">
                {(primary.dbType || 'mssql').toUpperCase()} · {primary.host}:{primary.port}/{primary.database}
              </span>
            </div>
          ) : (
            <p className="text-amber-400">Esasy database baglanyşyk ýok — Companies-de goşuň.</p>
          )}
          <div>
            <span className="text-neutral-500">Endpoint sany: </span>
            <span className="text-neutral-200">{endpoints.length}</span>
          </div>
        </div>

        {/* API list */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">
            Taýýar API-lar
          </h4>
          {endpoints.length === 0 ? (
            <p className="text-xs text-neutral-600 italic">Endpoint ýok.</p>
          ) : (
            <div className="max-h-56 overflow-y-auto space-y-1.5 rounded-lg border border-surface-border p-2">
              {endpoints.map((ep) => {
                const url = buildApiUrl(gatewayUrl, tenant, ep);
                return (
                  <div
                    key={ep.id}
                    className="flex items-start gap-2 rounded-md bg-surface-card/40 px-2.5 py-2 border border-surface-border/50"
                  >
                    <span className={`text-[10px] font-bold mt-0.5 ${METHOD_COLORS[ep.method]}`}>
                      {ep.method}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-neutral-200 truncate">{ep.name || ep.pathTemplate}</p>
                      <p className="text-[10px] font-mono text-neutral-500 truncate" title={url}>
                        {url}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 p-1 text-neutral-500 hover:text-neutral-200"
                      title="Copy"
                      onClick={() => void handleCopy(ep)}
                    >
                      {copiedId === ep.id ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    </button>
                    <button
                      type="button"
                      className="shrink-0 p-1 text-neutral-500 hover:text-neutral-200"
                      title="Brauzerde aç"
                      onClick={() => window.open(url, '_blank')}
                    >
                      <ExternalLink size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-[10px] text-neutral-600 mt-1.5">
            GET API-lar brauzerde açylýar. POST/PUT/DELETE üçin body bilen (Postman / curl) synag ediň.
            Content-Type: <span className="font-mono">application/json</span>
          </p>
        </div>

        {state !== 'idle' && (
          <div className="flex items-center gap-2">
            <Badge
              status={state === 'syncing' ? 'testing' : state}
              label={state === 'syncing' ? 'Syncing…' : state === 'success' ? 'Synced' : 'Failed'}
            />
            {message && <p className="text-xs text-neutral-400 break-words flex-1">{message}</p>}
          </div>
        )}
      </div>

      {/* Footer actions via extra row */}
      <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-surface-border -mb-1">
        <Button variant="ghost" className="!text-xs" onClick={onClose}>
          Ýap
        </Button>
        <Button
          className="!text-xs"
          disabled={!hasConn || state === 'syncing' || endpoints.length === 0}
          onClick={() => void handleSync()}
        >
          <CloudUpload size={13} className="inline mr-1" />
          {state === 'syncing' ? 'Syncing…' : 'One-Click Sync'}
        </Button>
      </div>
    </Modal>
  );
}
