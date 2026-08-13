import { useEffect, useState } from 'react';
import { Building2, Plus } from 'lucide-react';
import { useTenantStore } from '../store/useTenantStore';
import { TenantForm } from '../components/TenantManager/TenantForm';
import { TenantList } from '../components/TenantManager/TenantList';
import { TenantConnectionsPanel } from '../components/TenantManager/TenantConnectionsPanel';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import type { TenantConfig } from '../types/endpoint.types';
import { acquireEntityLock, releaseEntityLock } from '../lib/entityLock';

export function TenantsPage() {
  const { tenants, activeTenantId, setActiveTenant, createFromForm, updateTenant, hydrated } =
    useTenantStore();

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const activeTenant = tenants.find((t) => t.id === activeTenantId) ?? null;

  // Auto-select first company once; never force-close create modal
  useEffect(() => {
    if (!hydrated) return;
    if (tenants.length > 0 && !activeTenantId) {
      setActiveTenant(tenants[0].id);
    }
  }, [hydrated, tenants.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => setCreateOpen(true);
  const openEdit = async () => {
    if (!activeTenant) return;
    const ok = await acquireEntityLock({
      entityType: 'tenant',
      entityId: activeTenant.id,
      openedBy: 'electron',
    });
    if (ok) setEditOpen(true);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-4 sm:p-6">
      <div className="lg:col-span-1 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-100">Companies</h2>
          <Button variant="ghost" className="!px-2.5 !py-1.5 !text-xs" onClick={openCreate}>
            <Plus size={13} className="inline mr-1 -mt-0.5" />
            Täze
          </Button>
        </div>
        <TenantList
          tenants={tenants}
          activeId={activeTenantId}
          onSelect={(id) => {
            setActiveTenant(id);
            setEditOpen(false);
          }}
        />
      </div>

      <div className="lg:col-span-2">
        {activeTenant ? (
          <TenantConnectionsPanel tenant={activeTenant} onEditCompany={openEdit} />
        ) : (
          <div className="rounded-xl border border-dashed border-surface-border p-10 text-center space-y-3">
            <Building2 size={28} className="mx-auto text-neutral-600" />
            <p className="text-sm text-neutral-400">Entäk kompaniýa ýok</p>
            <Button onClick={openCreate} className="!text-xs">
              <Plus size={13} className="inline mr-1" />
              Täze kompaniýa goş
            </Button>
          </div>
        )}
      </div>

      {/* Create company — modal card (like DB connection modal) */}
      {createOpen && (
        <Modal
          title="Täze kompaniýa goş"
          onClose={() => setCreateOpen(false)}
          widthClass="max-w-2xl"
          footer={null}
        >
          <TenantForm
            mode="create"
            embedded
            onCreate={async (input) => {
              await createFromForm(input);
              setCreateOpen(false);
            }}
            onCancel={() => setCreateOpen(false)}
          />
        </Modal>
      )}

      {/* Edit company profile — modal */}
      {editOpen && activeTenant && (
        <Modal
          title="Kompaniýany üýtget"
          onClose={() => setEditOpen(false)}
          widthClass="max-w-2xl"
          footer={null}
        >
          <TenantForm
            mode="edit"
            embedded
            initial={activeTenant}
            onUpdate={(patch) => {
              updateTenant(activeTenant.id, patch);
              void releaseEntityLock({ entityType: 'tenant', entityId: activeTenant.id, openedBy: 'electron' });
              setEditOpen(false);
            }}
            onCancel={() => {
              void releaseEntityLock({ entityType: 'tenant', entityId: activeTenant.id, openedBy: 'electron' });
              setEditOpen(false);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
