import { Power, PowerOff } from 'lucide-react';
import type { TenantConfig } from '../../types/endpoint.types';
import { Badge } from '../ui/Badge';

interface Props {
  tenants: TenantConfig[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onToggleActive: (id: string) => void;
}

export function TenantList({ tenants, activeId, onSelect, onToggleActive }: Props) {
  return (
    <div className="space-y-2">
      {tenants.map((t) => {
        const passive = t.isActive === false;
        return (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            className={`w-full text-left p-3 rounded-lg border transition ${
              activeId === t.id
                ? 'bg-surface-card border-surface-border'
                : 'border-transparent hover:bg-surface-card/60'
            } ${passive ? 'opacity-75' : ''}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={`text-sm font-medium truncate ${
                  passive ? 'text-neutral-400' : 'text-neutral-100'
                }`}
              >
                {t.name}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                    passive
                      ? 'bg-neutral-700/60 text-neutral-400'
                      : 'bg-emerald-500/15 text-emerald-400'
                  }`}
                >
                  {passive ? 'Passiw' : 'Aktiw'}
                </span>
                <Badge status={t.connectionStatus} label={t.connectionStatus} />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleActive(t.id);
                  }}
                  className={`p-1 rounded-md transition-colors ${
                    passive
                      ? 'text-neutral-500 hover:text-neutral-300 hover:bg-surface-raised'
                      : 'text-emerald-400 hover:text-emerald-300 hover:bg-surface-raised'
                  }`}
                  title={passive ? 'Passiw' : 'Aktiw'}
                >
                  {passive ? <PowerOff size={14} /> : <Power size={14} />}
                </button>
              </div>
            </div>
            <p className="text-xs font-mono text-neutral-500 mt-0.5 truncate">/{t.slug}</p>
          </button>
        );
      })}
      {tenants.length === 0 && (
        <p className="text-xs text-neutral-600 italic px-1">No companies yet — add your first one on the right.</p>
      )}
    </div>
  );
}
