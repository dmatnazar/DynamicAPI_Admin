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
  const activeConnection =
    tenant.connections.find((c) => c.isPrimary) ?? tenant.connections[0];

  if (includeConnectionString && !activeConnection) {
    throw new Error('This company has no active database connection to sync yet.');
  }

  const slugify = (s: string) =>
    (s || 'primary')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'primary';

  const payload = {
    tenantSlug: tenant.slug,
    tenantName: tenant.name,
    ...(includeConnectionString && activeConnection
      ? { dbConnectionString: buildMssqlConnectionString(activeConnection) }
      : {}),
    ...(includeConnectionString
      ? {
          connections: tenant.connections.map((c) => ({
            dbKey: slugify(c.label || c.database || 'primary'),
            label: c.label,
            database: c.database,
            connectionString: buildMssqlConnectionString(c),
            isPrimary: c.isPrimary,
          })),
        }
      : {}),
    endpoints: endpoints.map((e) => {
      const conn =
        tenant.connections.find((c) => c.id === e.connectionId) ||
        tenant.connections.find((c) => c.isPrimary) ||
        tenant.connections[0];
      return {
        name: e.name,
        method: e.method,
        pathTemplate: e.pathTemplate,
        sqlQuery: e.sqlQuery,
        paramsSchema: e.paramsSchema,
        responseSchema: e.responseSchema,
        cacheTtlSec: e.cacheTtlSec,
        authRequired: e.authRequired,
        connectionId: e.connectionId || conn?.id,
        dbKey: slugify(conn?.label || conn?.database || 'primary'),
        database: conn?.database,
      };
    }),
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
