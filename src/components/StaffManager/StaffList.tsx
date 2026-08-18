import { Pencil, Trash2, Mail, Phone } from 'lucide-react';
import type { StaffMember } from '../../types/staff.types';
import { useTenantStore } from '../../store/useTenantStore';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

interface Props {
  staff: StaffMember[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}

const ROLE_LABEL: Record<StaffMember['role'], string> = {
  admin: 'Admin',
  manager: 'Manager',
  editor: 'Editor',
  viewer: 'Viewer',
};

export function StaffList({ staff, activeId, onSelect, onRemove }: Props) {
  const { tenants } = useTenantStore();

  if (staff.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-surface-border px-4 py-10 text-center text-sm text-neutral-500">
        Işgär ýok. Ýokarda täze işgär goşuň ýa-da BI hasaba alyş islegini tassyklaň.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-surface-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface-raised text-left text-neutral-400 border-b border-surface-border">
            <th className="px-3 py-2.5 font-medium">Ady</th>
            <th className="px-3 py-2.5 font-medium">Login</th>
            <th className="px-3 py-2.5 font-medium hidden md:table-cell">Telefon</th>
            <th className="px-3 py-2.5 font-medium hidden lg:table-cell">Email</th>
            <th className="px-3 py-2.5 font-medium">Rol</th>
            <th className="px-3 py-2.5 font-medium hidden sm:table-cell">Kompaniýa</th>
            <th className="px-3 py-2.5 font-medium">Status</th>
            <th className="px-3 py-2.5 font-medium w-24">Amal</th>
          </tr>
        </thead>
        <tbody>
          {staff.map((m) => {
            const companyNames = tenants
              .filter((t) => m.tenantIds.includes(t.id))
              .map((t) => t.name)
              .join(', ');
            return (
              <tr
                key={m.id}
                className={`border-b border-surface-border/60 hover:bg-surface-card/50 ${
                  activeId === m.id ? 'bg-surface-card' : ''
                }`}
              >
                <td className="px-3 py-2.5 text-neutral-100 font-medium">{m.fullName}</td>
                <td className="px-3 py-2.5 text-neutral-400">@{m.username}</td>
                <td className="px-3 py-2.5 text-neutral-400 hidden md:table-cell">
                  {m.phone ? (
                    <span className="inline-flex items-center gap-1">
                      <Phone size={12} /> {m.phone}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-3 py-2.5 text-neutral-400 hidden lg:table-cell truncate max-w-[160px]">
                  {m.email ? (
                    <span className="inline-flex items-center gap-1">
                      <Mail size={12} /> {m.email}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <span className="text-xs text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-md">
                    {ROLE_LABEL[m.role]}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-xs text-neutral-500 hidden sm:table-cell truncate max-w-[140px]">
                  {companyNames || '—'}
                </td>
                <td className="px-3 py-2.5">
                  <Badge status={m.active ? 'active' : 'inactive'} label={m.active ? 'Işjeň' : 'Öçürilen'} />
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onSelect(m.id)}
                      className="p-1.5 rounded-lg text-neutral-400 hover:text-indigo-300 hover:bg-indigo-500/10"
                      title="Üýtget"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`"${m.fullName}" pozulsynmy?`)) onRemove(m.id);
                      }}
                      className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10"
                      title="Poz"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
