import { useEffect, useState } from 'react';
import { Building2, Plus } from 'lucide-react';
import { useTenantStore } from '../store/useTenantStore';
import { TenantForm } from '../components/TenantManager/TenantForm';
import { TenantList } from '../components/TenantManager/TenantList';
import { TenantConnectionsPanel } from '../components/TenantManager/TenantConnectionsPanel';
import { ConnectionFormModal } from '../components/TenantManager/ConnectionFormModal';
import { QuickStaffCreate } from '../components/TenantManager/QuickStaffCreate';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import type { TenantConfig, TenantConnection } from '../types/endpoint.types';
import { acquireEntityLock, releaseEntityLock } from '../lib/entityLock';

type OnboardingStep = 'company' | 'connection' | 'staff' | null;

interface OnboardingState {
  step: OnboardingStep;
  companyId: string | null;
}

export function TenantsPage() {
  const { tenants, activeTenantId, setActiveTenant, createFromForm, createCompanyBasic, updateTenant, addConnection, toggleTenantActive, hydrated } =
    useTenantStore();

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [onboarding, setOnboarding] = useState<OnboardingState>({ step: null, companyId: null });

  const activeTenant = tenants.find((t) => t.id === activeTenantId) ?? null;

  // Auto-select first company once; never force-close create modal
  useEffect(() => {
    if (!hydrated) return;
    if (tenants.length > 0 && !activeTenantId) {
      setActiveTenant(tenants[0].id);
    }
  }, [hydrated, tenants.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Firma pozulanda edit modal ýapylsyn (ghost UI galmasyn)
  useEffect(() => {
    if (editOpen && !activeTenant) {
      setEditOpen(false);
    }
  }, [editOpen, activeTenant]);

  const openCreate = () => setCreateOpen(true);
  const startOnboarding = () => setOnboarding({ step: 'company', companyId: null });

  const openEdit = async () => {
    if (!activeTenant) return;
    const ok = await acquireEntityLock({
      entityType: 'tenant',
      entityId: activeTenant.id,
      openedBy: 'electron',
    });
    if (ok) setEditOpen(true);
  };

  const handleCompanyCreated = async (input: { name: string; slug: string }) => {
    const company = await createCompanyBasic({
      name: input.name,
      slug: input.slug,
      isActive: true,
    });
    setOnboarding({ step: 'connection', companyId: company.id });
  };

  const handleConnectionSaved = (conn: TenantConnection) => {
    if (onboarding.companyId) {
      addConnection(onboarding.companyId, conn);
    }
    setOnboarding((prev) => ({ ...prev, step: 'staff' }));
  };

  const handleStaffCreated = () => {
    setOnboarding({ step: null, companyId: null });
  };

  const cancelOnboarding = () => {
    setOnboarding({ step: null, companyId: null });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-4 sm:p-6">
      <div className="lg:col-span-1 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-100">Companies</h2>
          <div className="flex items-center gap-1">
            <Button variant="ghost" className="!px-2.5 !py-1.5 !text-xs" onClick={startOnboarding}>
              <Plus size={13} className="inline mr-1 -mt-0.5" />
              Täze kompaniýa
            </Button>
          </div>
        </div>
        <TenantList
          tenants={tenants}
          activeId={activeTenantId}
          onSelect={(id) => {
            setActiveTenant(id);
            setEditOpen(false);
          }}
          onToggleActive={toggleTenantActive}
        />
      </div>

      <div className="lg:col-span-2">
        {activeTenant ? (
          <TenantConnectionsPanel tenant={activeTenant} onEditCompany={openEdit} />
        ) : (
          <div className="rounded-xl border border-dashed border-surface-border p-10 text-center space-y-3">
            <Building2 size={28} className="mx-auto text-neutral-600" />
            <p className="text-sm text-neutral-400">Entäk kompaniýa ýok</p>
            <Button onClick={startOnboarding} className="!text-xs">
              <Plus size={13} className="inline mr-1" />
              Täze kompaniýa goş
            </Button>
          </div>
        )}
      </div>

      {/* Full create company — modal card */}
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

      {/* Onboarding: Step 1 — Company Info */}
      {onboarding.step === 'company' && (
        <Modal title="Täze kompaniýa" onClose={cancelOnboarding} widthClass="max-w-xl" footer={null}>
          <TenantForm
            mode="create"
            quick
            embedded
            onCreate={async (input) => {
              await handleCompanyCreated({ name: input.name, slug: input.slug });
            }}
            onCancel={cancelOnboarding}
          />
        </Modal>
      )}

      {/* Onboarding: Step 2 — Connection */}
      {onboarding.step === 'connection' && onboarding.companyId && (
        <ConnectionFormModal
          open
          onClose={cancelOnboarding}
          onSave={handleConnectionSaved}
        />
      )}

      {/* Onboarding: Step 3 — Staff */}
      {onboarding.step === 'staff' && onboarding.companyId && (
        <QuickStaffCreate
          open
          tenantId={onboarding.companyId}
          onClose={cancelOnboarding}
          onComplete={handleStaffCreated}
        />
      )}
    </div>
  );
}
