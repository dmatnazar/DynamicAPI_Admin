import { useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';
import type { EndpointConfig, TenantConfig } from '../../types/endpoint.types';
import { Badge } from '../ui/Badge';
import { buildApiUrl, copyText } from '../../lib/apiUrl';
import { getConnectionForEndpoint } from '../../types/endpoint.types';

interface Props {
  endpoints: EndpointConfig[];
  activeId: string | null;
  onSelect: (id: string) => void;
  gatewayUrl: string;
  tenant: TenantConfig | null;
}

const METHOD_COLORS: Record<string, string> = {
  GET: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  POST: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
  PUT: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  DELETE: 'text-red-400 bg-red-500/10 border-red-500/30',
};

export function EndpointList({ endpoints, activeId, onSelect, gatewayUrl, tenant }: Props) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (e: React.MouseEvent, ep: EndpointConfig) => {
    e.stopPropagation();
    e.preventDefault();
    const url = buildApiUrl(gatewayUrl, tenant, ep);
    if (await copyText(url)) {
      setCopiedId(ep.id);
      setTimeout(() => setCopiedId(null), 1500);
    }
  };

  const handleOpen = (e: React.MouseEvent, ep: EndpointConfig) => {
    e.stopPropagation();
    e.preventDefault();
    window.open(buildApiUrl(gatewayUrl, tenant, ep), '_blank');
  };

  return (
    <div className="space-y-1.5">
      {endpoints.map((ep) => {
        const fullUrl = buildApiUrl(gatewayUrl, tenant, ep);
        const isActive = activeId === ep.id;
        const conn = getConnectionForEndpoint(tenant, ep);
        return (
          <div
            key={ep.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(ep.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(ep.id);
              }
            }}
            className={`w-full text-left px-3 py-2.5 rounded-lg border transition cursor-pointer ${
              isActive
                ? 'bg-surface-card border-surface-border shadow-sm ring-1 ring-blue-500/30'
                : 'border-transparent hover:bg-surface-card/60'
            }`}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${METHOD_COLORS[ep.method] || ''}`}
              >
                {ep.method}
              </span>
              <span className="text-sm text-neutral-100 font-medium truncate flex-1 min-w-0">
                {ep.name || 'Adsyz'}
              </span>
              <Badge
                status={ep.authRequired ? 'active' : 'unknown'}
                label={ep.authRequired ? 'Auth' : 'Public'}
              />
            </div>

            <p className="text-[11px] font-mono text-neutral-500 mt-1 truncate">{ep.pathTemplate}</p>
            {conn && (
              <p className="text-[10px] text-neutral-600 mt-0.5 truncate">
                DB: {conn.label} · {conn.database}
              </p>
            )}

            <div className="mt-1.5 flex items-center gap-1">
              <p
                className="flex-1 min-w-0 text-[10px] font-mono text-neutral-600 truncate"
                title={fullUrl}
              >
                {fullUrl}
              </p>
              <button
                type="button"
                onClick={(e) => void handleCopy(e, ep)}
                className="shrink-0 p-1 rounded text-neutral-500 hover:text-neutral-200 hover:bg-surface-raised"
                title="Copy"
              >
                {copiedId === ep.id ? (
                  <Check size={12} className="text-emerald-400" />
                ) : (
                  <Copy size={12} />
                )}
              </button>
              <button
                type="button"
                onClick={(e) => handleOpen(e, ep)}
                className="shrink-0 p-1 rounded text-neutral-500 hover:text-neutral-200 hover:bg-surface-raised"
                title="Brauzerde aç"
              >
                <ExternalLink size={12} />
              </button>
            </div>
          </div>
        );
      })}
      {endpoints.length === 0 && (
        <p className="text-xs text-neutral-600 italic px-3 py-2">
          Endpoint ýok. «Täze» basyp dörediň.
        </p>
      )}
    </div>
  );
}
