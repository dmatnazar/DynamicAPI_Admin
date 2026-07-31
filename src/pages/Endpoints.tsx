import { useEffect, useState } from 'react';
import { useTenantStore } from '../store/useTenantStore';
import { useEndpointStore } from '../store/useEndpointStore';
import { EndpointList } from '../components/ApiBuilder/EndpointList';
import { EndpointEditor } from '../components/ApiBuilder/EndpointEditor';
import { SyncStatusCard } from '../components/SyncPanel/SyncStatusCard';
import { Button } from '../components/ui/Button';
import uuid from '../lib/uuid';
import type { EndpointConfig } from '../types/endpoint.types';

const DEFAULT_GATEWAY_URL = 'http://localhost:4000';

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

  const [gatewayUrl, setGatewayUrl] = useState(DEFAULT_GATEWAY_URL);
  const [adminSecret, setAdminSecret] = useState('');

  // Gateway URL / secret now live in Settings (see src/pages/Settings.tsx),
  // stored via the encrypted OS vault instead of being hardcoded here.
  useEffect(() => {
    window.vaultAPI.get('gatewayUrl').then((v) => v && setGatewayUrl(v));
    window.vaultAPI.get('adminSyncSecret').then((v) => v && setAdminSecret(v));
  }, []);

  const endpoints = activeTenantId ? endpointsByTenant[activeTenantId] ?? [] : [];
  const activeEndpoint = endpoints.find((e) => e.id === activeEndpointId) ?? null;

  if (!activeTenant) {
    return (
      <div className="p-4 sm:p-6">
        <p className="text-sm text-neutral-500">Select or create a company first (Companies tab).</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-4 gap-6 p-4 sm:p-6 h-full">
      <div className="lg:col-span-1 space-y-3">
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
            gatewayUrl={gatewayUrl}
            adminSecret={adminSecret}
            tenant={activeTenant}
            endpoints={endpoints}
          />
        </div>
      </div>

      <div className="lg:col-span-3 min-w-0">
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
