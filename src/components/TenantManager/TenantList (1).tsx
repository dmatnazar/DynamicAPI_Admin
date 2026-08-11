import type { TenantConfig } from '../../types/endpoint.types';
import { Badge } from '../ui/Badge';

interface Props {
  tenants: TenantConfig[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

/**
 * Legacy duplicate of TenantList.tsx — kept only so tsc does not fail if this
 * filename still exists on disk. Prefer importing from ./TenantList instead.
 * Safe to delete this file entirely.
 */
export function TenantList({ tenants, activeId, onSelect }: Props) {
  return (
    <div className="space-y-2">
      {tenants.map((t) => {
        const primary = t.connections.find((c) => c.isPrimary) ?? t.connections[0];
        const status = primary?.connectionStatus ?? t.connectionStatus ?? 'unknown';
        return (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            className={`w-full text-left p-3 rounded-lg border transition ${
              activeId === t.id
                ? 'bg-surface-card border-surface-border'
                : 'border-transparent hover:bg-surface-card/60'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-neutral-100 truncate">{t.name}</span>
              {primary ? (
                <Badge status={status} label={status} />
              ) : (
                <Badge status="unknown" label="DB ýok" />
              )}
            </div>
            <p className="text-xs text-neutral-500 mt-0.5 truncate">
              /{t.slug} · {t.connections.length} connection
            </p>
          </button>
        );
      })}
      {tenants.length === 0 && (
        <p className="text-xs text-neutral-600 italic px-1">
          No companies yet — add your first one on the right.
        </p>
      )}
    </div>
  );
}
