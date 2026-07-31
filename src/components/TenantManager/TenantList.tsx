import type { TenantConfig } from '../../types/endpoint.types';
import { Badge } from '../ui/Badge';

interface Props {
  tenants: TenantConfig[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

export function TenantList({ tenants, activeId, onSelect }: Props) {
  return (
    <div className="space-y-2">
      {tenants.map((t) => (
        <button
          key={t.id}
          onClick={() => onSelect(t.id)}
          className={`w-full text-left p-3 rounded-lg border transition ${
            activeId === t.id ? 'bg-surface-card border-surface-border' : 'border-transparent hover:bg-surface-card/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-neutral-100">{t.name}</span>
            <Badge status={t.connectionStatus} label={t.connectionStatus} />
          </div>
          <p className="text-xs font-mono text-neutral-500 mt-0.5">/{t.slug}</p>
        </button>
      ))}
      {tenants.length === 0 && (
        <p className="text-xs text-neutral-600 italic px-1">No tenants yet — add your first company below.</p>
      )}
    </div>
  );
}
