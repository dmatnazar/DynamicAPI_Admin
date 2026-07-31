import { useTenantStore } from '../store/useTenantStore';
import { TenantForm } from '../components/TenantManager/TenantForm';
import { TenantList } from '../components/TenantManager/TenantList';
import crypto from '../lib/uuid';

export function TenantsPage() {
  const { tenants, activeTenantId, addTenant, setActiveTenant } = useTenantStore();

  return (
    <div className="grid grid-cols-3 gap-6 p-6">
      <div className="col-span-1 space-y-4">
        <h2 className="text-lg font-semibold text-neutral-100">Tenants</h2>
        <TenantList tenants={tenants} activeId={activeTenantId} onSelect={setActiveTenant} />
      </div>
      <div className="col-span-2">
        <TenantForm
          onCreate={(t) =>
            addTenant({ id: crypto.uuid(), connectionStatus: 'success', ...t })
          }
        />
      </div>
    </div>
  );
}
