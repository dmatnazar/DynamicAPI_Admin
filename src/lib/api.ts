import type { TenantConfig, EndpointConfig } from '../types/endpoint.types';
import { buildMssqlConnectionString } from '../types/endpoint.types';

export interface SyncResult {
  status: 'success' | 'failed';
  tenantSlug: string;
  endpointsLoaded: number;
  syncedAt: string;
}

/**
 * Pushes a tenant's config + endpoints to the VPS gateway. The payload is
 * HMAC-signed in the Electron main process (via cryptoAPI, see preload.ts)
 * so the signing secret never lives in the renderer's memory space.
 */
export async function syncToVps(
  gatewayUrl: string,
  adminSecret: string,
  tenant: TenantConfig,
  endpoints: EndpointConfig[],
  includeConnectionString: boolean
): Promise<SyncResult> {
  const activeConnection = tenant.connections.find((c) => c.id === tenant.activeConnectionId);
  if (includeConnectionString && !activeConnection) {
    throw new Error('This company has no active database connection to sync yet.');
  }

  const payload = {
    tenantSlug: tenant.slug,
    tenantName: tenant.name,
    ...(includeConnectionString && activeConnection
      ? { dbConnectionString: buildMssqlConnectionString(activeConnection) }
      : {}),
    endpoints: endpoints.map((e) => ({
      name: e.name,
      method: e.method,
      pathTemplate: e.pathTemplate,
      sqlQuery: e.sqlQuery,
      paramsSchema: e.paramsSchema,
      responseSchema: e.responseSchema,
      cacheTtlSec: e.cacheTtlSec,
      authRequired: e.authRequired,
    })),
  };

  const signature = await window.cryptoAPI.signPayload(payload, adminSecret);

  const res = await fetch(`${gatewayUrl.replace(/\/$/, '')}/api/admin/sync-schema`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Signature': signature,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ? JSON.stringify(body.error) : `Sync failed: ${res.status}`);
  }

  return res.json();
}

export async function checkGatewayHealth(gatewayUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${gatewayUrl.replace(/\/$/, '')}/health`);
    return res.ok;
  } catch {
    return false;
  }
}
