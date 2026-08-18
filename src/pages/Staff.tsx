import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Mail, Phone } from 'lucide-react';
import { useStaffStore } from '../store/useStaffStore';
import { useTenantStore } from '../store/useTenantStore';
import { RegistrationsPanel } from '../components/StaffManager/RegistrationsPanel';
import { StaffForm } from '../components/StaffManager/StaffForm';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { DataTable, type DataTableColumn } from '../components/ui/DataTable';
import { confirmDialog } from '../components/ui/ConfirmDialog';
import { toastSuccess, toastError } from '../components/ui/Toast';
import type { StaffMember } from '../types/staff.types';
import { acquireEntityLock, releaseEntityLock } from '../lib/entityLock';
import { deleteStaffOnVps } from '../lib/api';

const ROLE_LABEL: Record<StaffMember['role'], string> = {
  admin: 'Admin',
  manager: 'Manager',
  editor: 'Editor',
  viewer: 'Viewer',
};

export function StaffPage() {
  const { staff, addStaff, updateStaff, removeStaff } = useStaffStore();
  const tenants = useTenantStore((s) => s.tenants);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = async (m: StaffMember) => {
    try {
      const ok = await acquireEntityLock({
        entityType: 'staff',
        entityId: m.id,
        openedBy: 'electron',
      });
      if (!ok) return;
    } catch {
      /* offline / lock error — still open */
    }
    setEditing(m);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (editing) {
      void releaseEntityLock({ entityType: 'staff', entityId: editing.id, openedBy: 'electron' });
    }
    setModalOpen(false);
    setEditing(null);
  };

  const columns = useMemo<DataTableColumn<StaffMember>[]>(
    () => [
      {
        id: 'fullName',
        header: 'Ady',
        accessor: (r) => r.fullName,
        cell: (r) => <span className="font-medium text-neutral-100">{r.fullName}</span>,
        width: 160,
      },
      {
        id: 'username',
        header: 'Login',
        accessor: (r) => r.username,
        cell: (r) => <span className="text-neutral-400">@{r.username}</span>,
        width: 120,
      },
      {
        id: 'companies',
        header: 'Firma',
        accessor: (r) =>
          (r.tenantIds || [])
            .map((id) => tenants.find((t) => t.id === id)?.name || id)
            .join(', '),
        cell: (r) => {
          const names = (r.tenantIds || [])
            .map((id) => tenants.find((t) => t.id === id)?.name)
            .filter(Boolean) as string[];
          if (names.length === 0) {
            return <span className="text-neutral-600 text-xs">—</span>;
          }
          return (
            <div className="flex flex-wrap gap-1">
              {names.map((n) => (
                <span
                  key={n}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/20"
                >
                  {n}
                </span>
              ))}
            </div>
          );
        },
        width: 180,
      },
      {
        id: 'phone',
        header: 'Telefon',
        accessor: (r) => r.phone || '',
        cell: (r) =>
          r.phone ? (
            <span className="inline-flex items-center gap-1 text-neutral-300">
              <Phone size={12} /> {r.phone}
            </span>
          ) : (
            <span className="text-neutral-600">—</span>
          ),
        width: 130,
      },
      {
        id: 'email',
        header: 'Email',
        accessor: (r) => r.email || '',
        cell: (r) =>
          r.email ? (
            <span className="inline-flex items-center gap-1 text-neutral-300 truncate max-w-[180px]">
              <Mail size={12} /> {r.email}
            </span>
          ) : (
            <span className="text-neutral-600">—</span>
          ),
        width: 180,
      },
      {
        id: 'role',
        header: 'Rol',
        accessor: (r) => r.role,
        cell: (r) => (
          <span className="text-xs text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-md">
            {ROLE_LABEL[r.role]}
          </span>
        ),
        width: 90,
      },
      {
        id: 'companies',
        header: 'Kompaniýa',
        accessor: (r) =>
          tenants
            .filter((t) => r.tenantIds.includes(t.id))
            .map((t) => t.name)
            .join(', '),
        cell: (r) => {
          const names = tenants
            .filter((t) => r.tenantIds.includes(t.id))
            .map((t) => t.name)
            .join(', ');
          return <span className="text-xs text-neutral-400 truncate max-w-[160px] block">{names || '—'}</span>;
        },
        width: 160,
      },
      {
        id: 'active',
        header: 'Status',
        accessor: (r) => (r.active ? 1 : 0),
        cell: (r) => (
          <Badge status={r.active ? 'active' : 'inactive'} label={r.active ? 'Işjeň' : 'Öçürilen'} />
        ),
        width: 100,
      },
      {
        id: 'actions',
        header: 'Amal',
        sortable: false,
        accessor: () => '',
        cell: (r) => (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => openEdit(r)}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-indigo-300 hover:bg-indigo-500/10"
              title="Üýtget"
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              onClick={async () => {
                const ok = await confirmDialog({
                  title: 'Işgäri poz',
                  message: `"${r.fullName}" (@${r.username}) pozulsynmy? Bu amaly yzyna dolandyryp bolmaýar.`,
                  confirmLabel: 'Poz',
                  danger: true,
                });
                if (!ok) return;
                // Always remove locally first so UI updates immediately
                removeStaff(r.id);
                toastSuccess('Işgär pozuldy', 'Lokal + VPS sync');
                try {
                  const settings = await window.dbAPI?.getSettings?.();
                  if (settings?.gatewayUrl && settings?.adminSecret) {
                    const res = await deleteStaffOnVps(settings.gatewayUrl, settings.adminSecret, {
                      id: r.id,
                      username: r.username,
                    });
                    if (!res.ok) {
                      console.warn('VPS staff-delete failed', res.status, res.body);
                    }
                  }
                } catch (e) {
                  console.warn('VPS staff-delete error', e);
                }
              }}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10"
              title="Poz"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ),
        width: 90,
      },
    ],
    [tenants, removeStaff]
  );

  return (
    <div className="p-4 sm:p-6 space-y-6 h-full">
      <div>
        <h2 className="text-lg font-semibold text-neutral-100">Işgärler</h2>
        <p className="text-xs text-neutral-500 mt-0.5">
          BI Platform ulanyjylary · goş, üýtget, poz · kompaniýa we rol
        </p>
      </div>

      <RegistrationsPanel />

      <DataTable
        columns={columns}
        rows={staff}
        rowKey={(r) => r.id}
        storageKey="staff-table"
        searchPlaceholder="Gözle: ady, login, tel, email..."
        emptyMessage="Işgär ýok. «Täze işgär» basyň ýa-da BI islegini tassyklaň."
        onRowClick={openEdit}
        toolbarRight={
          <button
            type="button"
            onClick={openCreate}
            className="h-9 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium inline-flex items-center gap-1.5 shrink-0"
          >
            <Plus size={14} />
            Täze işgär
          </button>
        }
      />

      {modalOpen && (
        <Modal
          title={editing ? 'Işgäri üýtget' : 'Täze işgär'}
          onClose={closeModal}
          widthClass="max-w-xl"
          footer={null}
        >
          <StaffForm
            key={editing?.id || 'new'}
            editing={editing}
            onCreate={(m) => {
              addStaff(m);
              closeModal();
            }}
            onUpdate={(id, patch) => {
              updateStaff(id, patch);
              closeModal();
            }}
            onCancelEdit={closeModal}
          />
        </Modal>
      )}
    </div>
  );
}
