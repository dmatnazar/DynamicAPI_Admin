import { useTenantStore } from '../store/useTenantStore';
import { useEndpointStore } from '../store/useEndpointStore';
import { EndpointList } from '../components/ApiBuilder/EndpointList';
import { EndpointEditor } from '../components/ApiBuilder/EndpointEditor';
import { SyncStatusCard } from '../components/SyncPanel/SyncStatusCard';
import { Button } from '../components/ui/Button';
import uuid from '../lib/uuid';
import type { EndpointConfig } from '../types/endpoint.types';

const GATEWAY_URL = 'http://localhost:4000';
const ADMIN_SECRET = 'e4a7d1c9b3f802e5a6c1b4f9d0e2a3c5b8f1d4e7a0c3b6f9e2d5a8c1b4f702e5'; // move to Settings/vault in production

function blankEndpoint(): EndpointConfig {
  return {
    id: uuid.uuid(),
    name: '',
    method: 'GET',
    pathTemplate: '/',
    sqlQuery: '-- SELECT ... FROM ... WHERE Id = @id',
    paramsSchema: { urlParams: [], queryParams: [], bodyParams: [] },
    cacheTtlSec: 0,
    authRequired: true,
  };
}

export function EndpointsPage() {
  const { tenants, activeTenantId } = useTenantStore();
  const activeTenant = tenants.find((t) => t.id === activeTenantId) ?? null;

  const { endpointsByTenant, activeEndpointId, addEndpoint, updateEndpoint, setActiveEndpoint } =
    useEndpointStore();

  const endpoints = activeTenantId ? endpointsByTenant[activeTenantId] ?? [] : [];
  const activeEndpoint = endpoints.find((e) => e.id === activeEndpointId) ?? null;

  if (!activeTenant) {
    return (
      <div className="p-6">
        <p className="text-sm text-neutral-500">Select or create a tenant first (Tenants tab).</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-6 p-6 h-full">
      <div className="col-span-1 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-100">Endpoints</h2>
          <Button
            variant="ghost"
            className="!p-1.5"
            onClick={() => addEndpoint(activeTenant.id, blankEndpoint())}
          >
            + New
          </Button>
        </div>
        <EndpointList endpoints={endpoints} activeId={activeEndpointId} onSelect={setActiveEndpoint} />
        <div className="pt-4">
          <SyncStatusCard
            gatewayUrl={GATEWAY_URL}
            adminSecret={ADMIN_SECRET}
            tenant={activeTenant}
            endpoints={endpoints}
          />
        </div>
      </div>

      <div className="col-span-3">
        {activeEndpoint ? (
          <EndpointEditor
            endpoint={activeEndpoint}
            onChange={(patch) => updateEndpoint(activeTenant.id, activeEndpoint.id, patch)}
          />
        ) : (
          <p className="text-sm text-neutral-500">Select an endpoint on the left, or create a new one.</p>
        )}
      </div>
    </div>
  );
}
