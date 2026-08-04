import { Users, Trash2 } from 'lucide-react';
import type { StaffMember } from '../../types/staff.types';
import { useTenantStore } from '../../store/useTenantStore';
import { Badge } from '../ui/Badge';

interface Props {
  staff: StaffMember[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}

const ROLE_LABEL: Record<StaffMember['role'], string> = {
  admin: 'Admin',
  editor: 'Editor',
  viewer: 'Viewer',
};

export function StaffList({ staff, activeId, onSelect, onRemove }: Props) {
  const { tenants } = useTenantStore();

  return (
    <div className="space-y-1">
      {staff.map((m) => (
        <div
          key={m.id}
          className={`w-full rounded-lg border transition flex items-start gap-1 ${
            activeId === m.id ? 'bg-surface-card border-surface-border' : 'border-transparent hover:bg-surface-card/60'
          }`}
        >
          <button onClick={() => onSelect(m.id)} className="flex-1 min-w-0 text-left px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-neutral-200 truncate">{m.fullName}</span>
              <Badge status={m.active ? 'active' : 'inactive'} label={m.active ? 'Active' : 'Disabled'} />
            </div>
            <p className="text-xs text-neutral-500 truncate mt-0.5">
              @{m.username} · {ROLE_LABEL[m.role]}
            </p>
            <p className="text-[11px] text-neutral-600 truncate mt-0.5 flex items-center gap-1">
              <Users size={11} className="shrink-0" />
              {m.tenantIds.length === 0
                ? 'No companies assigned'
                : m.tenantIds
                    .map((id) => tenants.find((t) => t.id === id)?.name)
                    .filter(Boolean)
                    .join(', ')}
            </p>
          </button>
          <button
            onClick={() => onRemove(m.id)}
            className="shrink-0 self-center mr-2 p-1.5 text-neutral-500 hover:text-red-400"
            title="Remove worker"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      {staff.length === 0 && (
        <p className="text-xs text-neutral-600 italic px-3 py-2">No workers yet. Add one on the right.</p>
      )}
    </div>
  );
}
