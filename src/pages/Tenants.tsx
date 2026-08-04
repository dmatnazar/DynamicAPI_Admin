import { useTenantStore } from '../store/useTenantStore';
import { TenantForm } from '../components/TenantManager/TenantForm';
import { TenantList } from '../components/TenantManager/TenantList';
import { TenantConnectionsPanel } from '../components/TenantManager/TenantConnectionsPanel';
import { Button } from '../components/ui/Button';
import uuid from '../lib/uuid';

export function TenantsPage() {
  const { tenants, activeTenantId, addTenant, setActiveTenant } = useTenantStore();
  const activeTenant = tenants.find((t) => t.id === activeTenantId) ?? null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-4 sm:p-6">
      <div className="lg:col-span-1 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-100">Companies</h2>
          {activeTenant && (
            <Button variant="ghost" className="!px-2.5 !py-1.5 !text-xs" onClick={() => setActiveTenant(null)}>
              + New
            </Button>
          )}
        </div>
        <TenantList tenants={tenants} activeId={activeTenantId} onSelect={setActiveTenant} />
      </div>
      <div className="lg:col-span-2">
        {activeTenant ? (
          <TenantConnectionsPanel tenant={activeTenant} />
        ) : (
          <TenantForm
            onCreate={(t) => {
              const connectionId = uuid.uuid();
              addTenant({
                id: uuid.uuid(),
                slug: t.slug,
                name: t.name,
                dbConnectionString: t.connectionString,
                connectionStatus: 'success',
                connections: [
                  {
                    id: connectionId,
                    label: 'Primary',
                    connectionString: t.connectionString,
                    isPrimary: true,
                    connectionStatus: 'success',
                  },
                ],
              });
            }}
          />
        )}
      </div>
    </div>
  );
}
