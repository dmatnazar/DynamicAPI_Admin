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


/** Sync staff members for a tenant to VPS hub (BI Platform consumes these) */
export async function syncStaffToVps(
  gatewayUrl: string,
  adminSecret: string,
  tenantSlug: string,
  staff: Array<{
    id: string;
    fullName: string;
    username: string;
    passwordHash: string;
    role: string;
    tenantSlugs?: string[];
    phone?: string;
    email?: string;
    active: boolean;
    passwordPlain?: string;
    passwordEnc?: string;
  }>
): Promise<{ status: string; staffLoaded: number }> {
  const payload = { tenantSlug, staff };
  const signature = await window.cryptoAPI.signPayload(payload, adminSecret);
  const res = await fetch(`${gatewayUrl.replace(/\/$/, '')}/api/admin/sync-staff`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Signature': signature,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ? JSON.stringify(body.error) : `Staff sync failed: ${res.status}`);
  }
  return res.json();
}

/** Poll pending registrations for a tenant from VPS hub */
export async function fetchPendingRegistrations(
  gatewayUrl: string,
  adminSecret: string,
  tenantSlug: string
): Promise<any[]> {
  // GET signs empty object "{}"
  const signature = await window.cryptoAPI.signPayload({}, adminSecret);
  const url = `${gatewayUrl.replace(/\/$/, '')}/api/admin/registrations?tenantSlug=${encodeURIComponent(tenantSlug)}&status=pending&markDelivered=1`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Signature': signature,
    },
  });
  if (!res.ok) {
    throw new Error(`Fetch registrations failed: ${res.status}`);
  }
  const data = await res.json();
  return data.registrations || [];
}

/** Approve or reject a BI registration — creates staff on VPS */
export async function resolveRegistrationOnVps(
  gatewayUrl: string,
  adminSecret: string,
  payload: {
    id: string;
    action: 'approve' | 'reject';
    role?: string;
    note?: string;
    reviewedBy?: string;
  }
): Promise<any> {
  const signature = await window.cryptoAPI.signPayload(payload, adminSecret);
  const res = await fetch(`${gatewayUrl.replace(/\/$/, '')}/api/admin/registrations/resolve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Signature': signature,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ? JSON.stringify(body.error) : `Resolve failed: ${res.status}`);
  }
  return res.json();
}


export async function updateRegistrationOnVps(
  gatewayUrl: string,
  adminSecret: string,
  payload: {
    id: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
    username?: string;
    requestedRole?: string;
    note?: string;
  }
): Promise<any> {
  const signature = await window.cryptoAPI.signPayload(payload, adminSecret);
  const res = await fetch(`${gatewayUrl.replace(/\/$/, '')}/api/admin/registrations/update`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Signature': signature,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ? JSON.stringify(body.error) : `Update failed: ${res.status}`);
  }
  return res.json();
}


/** Pull full catalog from VPS (staff, tenants, endpoints) */
export async function fetchCatalogFromVps(
  gatewayUrl: string,
  adminSecret: string
): Promise<{
  tenants: any[];
  endpoints: any[];
  staff: any[];
  syncedAt?: string;
}> {
  const signature = await window.cryptoAPI.signPayload({}, adminSecret);
  const res = await fetch(`${gatewayUrl.replace(/\/$/, '')}/api/admin/catalog`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Signature': signature,
    },
  });
  if (!res.ok) throw new Error(`Catalog fetch failed: ${res.status}`);
  return res.json();
}

/** Soft-deactivate tenant on VPS (is_active=0) */
export async function deactivateTenantOnVps(
  gatewayUrl: string,
  adminSecret: string,
  slug: string
): Promise<void> {
  const payload = { slug, isActive: false };
  const signature = await window.cryptoAPI.signPayload(payload, adminSecret);
  const res = await fetch(`${gatewayUrl.replace(/\/$/, '')}/api/admin/tenant-update`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Signature': signature,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ? JSON.stringify(body.error) : `Tenant deactivate failed: ${res.status}`);
  }
}

async function signedPost(gatewayUrl: string, adminSecret: string, path: string, payload: Record<string, unknown>) {
  const signature = await window.cryptoAPI.signPayload(payload, adminSecret);
  const res = await fetch(`${gatewayUrl.replace(/\/$/, '')}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Signature': signature,
    },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

/** Hard-delete tenant — fails with has_dependencies if staff/APIs remain */
export async function deleteTenantOnVps(
  gatewayUrl: string,
  adminSecret: string,
  slug: string
): Promise<{ ok: boolean; status: number; body: any }> {
  return signedPost(gatewayUrl, adminSecret, '/api/admin/tenant-delete', { slug });
}

/** Hard-delete staff on VPS */
export async function deleteStaffOnVps(
  gatewayUrl: string,
  adminSecret: string,
  opts: { id?: string; username?: string; tenantSlug?: string }
): Promise<{ ok: boolean; status: number; body: any }> {
  return signedPost(gatewayUrl, adminSecret, '/api/admin/staff-delete', opts as any);
}

/** Acquire / release / heartbeat edit lock (is_open) */
export async function entityLockOnVps(
  gatewayUrl: string,
  adminSecret: string,
  opts: {
    entityType: 'tenant' | 'staff' | 'endpoint';
    entityId: string;
    action: 'lock' | 'unlock' | 'heartbeat';
    openedBy?: string;
  }
): Promise<{ ok: boolean; status: number; body: any }> {
  return signedPost(gatewayUrl, adminSecret, '/api/admin/entity-lock', opts as any);
}

/** Tenant update with optional expectedUpdatedAt concurrency token */
export async function updateTenantOnVps(
  gatewayUrl: string,
  adminSecret: string,
  payload: {
    slug: string;
    name?: string;
    isActive?: boolean;
    expectedUpdatedAt?: string;
  }
): Promise<{ ok: boolean; status: number; body: any }> {
  return signedPost(gatewayUrl, adminSecret, '/api/admin/tenant-update', payload as any);
}

/** Ensure tenant exists on VPS — creates it if missing */
export async function ensureTenantOnVps(
  gatewayUrl: string,
  adminSecret: string,
  tenant: { id: string; slug: string; name: string }
): Promise<{ ok: boolean; created: boolean; status: number; body: any }> {
  try {
    const check = await signedPost(gatewayUrl, adminSecret, '/api/admin/catalog', {});
    if (check.ok && check.body) {
      const exists = (check.body.tenants || []).some(
        (t: any) => t.slug === tenant.slug || t.id === tenant.id
      );
      if (exists) {
        return { ok: true, created: false, status: 200, body: null };
      }
    }
  } catch {
    // ignore catalog check failure, try to create anyway
  }

  const res = await signedPost(gatewayUrl, adminSecret, '/api/admin/tenant-create', {
    slug: tenant.slug,
    name: tenant.name,
  });
  return { ok: res.ok, created: res.ok && res.status === 200, status: res.status, body: res.body };
}


