import { useTenantStore } from '../store/useTenantStore';
import { useStaffStore } from '../store/useStaffStore';
import { useEndpointStore } from '../store/useEndpointStore';
import type { TenantConfig, TenantConnection, EndpointConfig } from '../types/endpoint.types';
import type { StaffMember } from '../types/staff.types';
import { buildMssqlConnectionString } from '../types/endpoint.types';

/**
 * Load all data from the local DB (Electron main process) into Zustand stores.
 * Call once on app start.
 */
export async function hydrateStoresFromLocalDb(): Promise<void> {
  if (!window.dbAPI) {
    useTenantStore.getState().setHydrated(true);
    return;
  }

  try {
    const snap = await window.dbAPI.exportSnapshot();

    const connectionsByCompany = new Map<string, TenantConnection[]>();
    for (const raw of snap.connections) {
      const c = raw as {
        id: string;
        companyId: string;
        label: string;
        host: string;
        port: number;
        database: string;
        username: string;
        password?: string;
        encrypt?: boolean;
        trustServerCertificate?: boolean;
        isPrimary: boolean;
        connectionStatus: TenantConnection['connectionStatus'];
      };
      const conn: TenantConnection = {
        id: c.id,
        label: c.label,
        dbType: (c as { dbType?: string }).dbType === 'postgresql' ? 'postgresql'
          : (c as { dbType?: string }).dbType === 'mysql' ? 'mysql'
          : (c as { dbType?: string }).dbType === 'oracle' ? 'oracle'
          : (c as { dbType?: string }).dbType === 'sqlite' ? 'sqlite'
          : 'mssql',
        host: c.host || '',
        port: c.port || 1433,
        database: c.database || '',
        username: c.username || '',
        password: c.password || '',
        encrypt: c.encrypt !== false,
        trustServerCertificate: c.trustServerCertificate !== false,
        isPrimary: !!c.isPrimary,
        connectionStatus: c.connectionStatus || 'unknown',
        connectionString: buildMssqlConnectionString({
          host: c.host,
          port: c.port,
          database: c.database,
          username: c.username,
          password: c.password,
          encrypt: c.encrypt,
          trustServerCertificate: c.trustServerCertificate,
        }),
      };
      const list = connectionsByCompany.get(c.companyId) ?? [];
      list.push(conn);
      connectionsByCompany.set(c.companyId, list);
    }

    const tenants: TenantConfig[] = (snap.companies as Array<Record<string, unknown>>).map((co) => {
      const connections = connectionsByCompany.get(String(co.id)) ?? [];
      const primary = connections.find((c) => c.isPrimary) ?? connections[0];
      return {
        id: String(co.id),
        slug: String(co.slug || ''),
        name: String(co.name || ''),
        legalName: co.legalName as string | undefined,
        taxId: co.taxId as string | undefined,
        registrationNumber: co.registrationNumber as string | undefined,
        industry: co.industry as string | undefined,
        country: co.country as string | undefined,
        city: co.city as string | undefined,
        address: co.address as string | undefined,
        phone: co.phone as string | undefined,
        email: co.email as string | undefined,
        website: co.website as string | undefined,
        contactPerson: co.contactPerson as string | undefined,
        contactPhone: co.contactPhone as string | undefined,
        contactEmail: co.contactEmail as string | undefined,
        notes: co.notes as string | undefined,
        connections,
        dbConnectionString: primary ? buildMssqlConnectionString(primary) : '',
        connectionStatus: primary?.connectionStatus ?? 'unknown',
        createdAt: co.createdAt as string | undefined,
        updatedAt: co.updatedAt as string | undefined,
      };
    });

    useTenantStore.getState().setTenants(tenants);

    const staff = (snap.staff as StaffMember[]).map((s) => ({
      ...s,
      tenantIds: s.tenantIds || [],
    }));
    useStaffStore.setState({ staff });

    const endpointsByTenant: Record<string, EndpointConfig[]> = {};
    for (const raw of snap.endpoints) {
      const e = raw as EndpointConfig & { companyId: string };
      const list = endpointsByTenant[e.companyId] ?? [];
      list.push({
        id: e.id,
        name: e.name,
        method: e.method,
        pathTemplate: e.pathTemplate,
        sqlQuery: e.sqlQuery,
        paramsSchema: e.paramsSchema,
        responseSchema: e.responseSchema,
        cacheTtlSec: e.cacheTtlSec,
        authRequired: e.authRequired,
        companyId: e.companyId,
        connectionId: (e as { connectionId?: string }).connectionId,
      });
      endpointsByTenant[e.companyId] = list;
    }
    useEndpointStore.setState({ endpointsByTenant });
  } catch (err) {
    console.error('Failed to hydrate from local DB', err);
  } finally {
    useTenantStore.getState().setHydrated(true);
  }
}
