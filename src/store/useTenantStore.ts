import { create } from 'zustand';
import type { TenantConfig, TenantConnection, CompanyFormInput } from '../types/endpoint.types';
import { buildMssqlConnectionString } from '../types/endpoint.types';
import uuid from '../lib/uuid';

interface TenantStore {
  tenants: TenantConfig[];
  activeTenantId: string | null;
  hydrated: boolean;
  setHydrated: (v: boolean) => void;
  setTenants: (tenants: TenantConfig[]) => void;
  addTenant: (tenant: TenantConfig) => void;
  updateTenant: (id: string, patch: Partial<TenantConfig>) => void;
  removeTenant: (id: string) => void;
  setActiveTenant: (id: string | null) => void;
  addConnection: (tenantId: string, connection: TenantConnection) => void;
  updateConnection: (tenantId: string, connectionId: string, patch: Partial<TenantConnection>) => void;
  removeConnection: (tenantId: string, connectionId: string) => void;
  setPrimaryConnection: (tenantId: string, connectionId: string) => void;
  /** Build full TenantConfig from form input and persist */
  createFromForm: (input: CompanyFormInput) => Promise<TenantConfig>;
}

function syncPrimaryMirror(tenant: TenantConfig): TenantConfig {
  const primary = tenant.connections.find((c) => c.isPrimary) ?? tenant.connections[0];
  const connStr = primary
    ? buildMssqlConnectionString(primary)
    : '';
  return {
    ...tenant,
    dbConnectionString: connStr,
    connectionStatus: primary?.connectionStatus ?? 'unknown',
  };
}

async function persistCompany(tenant: TenantConfig) {
  if (!window.dbAPI) return;
  const now = new Date().toISOString();
  await window.dbAPI.upsertCompany({
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    legalName: tenant.legalName,
    taxId: tenant.taxId,
    registrationNumber: tenant.registrationNumber,
    industry: tenant.industry,
    country: tenant.country,
    city: tenant.city,
    address: tenant.address,
    phone: tenant.phone,
    email: tenant.email,
    website: tenant.website,
    contactPerson: tenant.contactPerson,
    contactPhone: tenant.contactPhone,
    contactEmail: tenant.contactEmail,
    notes: tenant.notes,
    createdAt: tenant.createdAt || now,
    updatedAt: now,
  });
}

async function persistConnection(companyId: string, c: TenantConnection) {
  if (!window.dbAPI) return;
  const now = new Date().toISOString();
  await window.dbAPI.upsertConnection({
    id: c.id,
    companyId,
    label: c.label,
    dbType: c.dbType || 'mssql',
    host: c.host,
    port: c.port,
    database: c.database,
    username: c.username,
    password: c.password,
    encrypt: c.encrypt !== false,
    trustServerCertificate: c.trustServerCertificate !== false,
    isPrimary: c.isPrimary,
    connectionStatus: c.connectionStatus,
    createdAt: now,
    updatedAt: now,
  });
}

export const useTenantStore = create<TenantStore>((set, get) => ({
  tenants: [],
  activeTenantId: null,
  hydrated: false,

  setHydrated: (v) => set({ hydrated: v }),
  setTenants: (tenants) => set({ tenants }),

  addTenant: (tenant) => {
    set((s) => ({ tenants: [...s.tenants, tenant], activeTenantId: tenant.id }));
    void persistCompany(tenant);
    for (const c of tenant.connections) void persistConnection(tenant.id, c);
  },

  updateTenant: (id, patch) => {
    set((s) => ({
      tenants: s.tenants.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
    const t = get().tenants.find((x) => x.id === id);
    if (t) void persistCompany({ ...t, ...patch });
  },

  removeTenant: (id) => {
    set((s) => ({
      tenants: s.tenants.filter((t) => t.id !== id),
      activeTenantId: s.activeTenantId === id ? null : s.activeTenantId,
    }));
    void window.dbAPI?.deleteCompany(id);
  },

  setActiveTenant: (id) => set({ activeTenantId: id }),

  addConnection: (tenantId, connection) => {
    set((s) => ({
      tenants: s.tenants.map((t) => {
        if (t.id !== tenantId) return t;
        const makePrimary = t.connections.length === 0 ? true : connection.isPrimary;
        const nextConnections = [
          ...t.connections.map((c) => (makePrimary ? { ...c, isPrimary: false } : c)),
          { ...connection, isPrimary: makePrimary },
        ];
        return syncPrimaryMirror({ ...t, connections: nextConnections });
      }),
    }));
    void persistConnection(tenantId, {
      ...connection,
      isPrimary:
        get().tenants.find((t) => t.id === tenantId)?.connections.length === 0
          ? true
          : !!connection.isPrimary,
    });
  },

  updateConnection: (tenantId, connectionId, patch) => {
    set((s) => ({
      tenants: s.tenants.map((t) => {
        if (t.id !== tenantId) return t;
        const nextConnections = t.connections.map((c) =>
          c.id === connectionId ? { ...c, ...patch } : c
        );
        return syncPrimaryMirror({ ...t, connections: nextConnections });
      }),
    }));
    const t = get().tenants.find((x) => x.id === tenantId);
    const c = t?.connections.find((x) => x.id === connectionId);
    if (c) void persistConnection(tenantId, c);
  },

  removeConnection: (tenantId, connectionId) => {
    set((s) => ({
      tenants: s.tenants.map((t) => {
        if (t.id !== tenantId) return t;
        const wasPrimary = t.connections.find((c) => c.id === connectionId)?.isPrimary;
        let nextConnections = t.connections.filter((c) => c.id !== connectionId);
        if (wasPrimary && nextConnections.length > 0) {
          nextConnections = nextConnections.map((c, i) => ({ ...c, isPrimary: i === 0 }));
        }
        return syncPrimaryMirror({ ...t, connections: nextConnections });
      }),
    }));
    void window.dbAPI?.deleteConnection(connectionId);
  },

  setPrimaryConnection: (tenantId, connectionId) => {
    set((s) => ({
      tenants: s.tenants.map((t) => {
        if (t.id !== tenantId) return t;
        const nextConnections = t.connections.map((c) => ({
          ...c,
          isPrimary: c.id === connectionId,
        }));
        return syncPrimaryMirror({ ...t, connections: nextConnections });
      }),
    }));
    const t = get().tenants.find((x) => x.id === tenantId);
    if (t) {
      for (const c of t.connections) void persistConnection(tenantId, c);
    }
  },

  createFromForm: async (input) => {
    const now = new Date().toISOString();
    const companyId = uuid.uuid();
    const connectionId = uuid.uuid();
    const connection: TenantConnection = {
      id: connectionId,
      label: input.connLabel || 'Primary',
      dbType: input.dbType || 'mssql',
      host: input.host,
      port: input.port || 1433,
      database: input.database,
      username: input.username,
      password: input.password,
      encrypt: input.encrypt !== false,
      trustServerCertificate: input.trustServerCertificate !== false,
      isPrimary: true,
      connectionStatus: 'unknown',
      connectionString: buildMssqlConnectionString({ ...input, dbType: input.dbType || 'mssql' }),
    };
    const tenant: TenantConfig = {
      id: companyId,
      slug: input.slug,
      name: input.name,
      legalName: input.legalName,
      taxId: input.taxId,
      registrationNumber: input.registrationNumber,
      industry: input.industry,
      country: input.country,
      city: input.city,
      address: input.address,
      phone: input.phone,
      email: input.email,
      website: input.website,
      contactPerson: input.contactPerson,
      contactPhone: input.contactPhone,
      contactEmail: input.contactEmail,
      notes: input.notes,
      dbConnectionString: buildMssqlConnectionString(input),
      connectionStatus: 'unknown',
      connections: [connection],
      createdAt: now,
      updatedAt: now,
    };
    get().addTenant(tenant);
    return tenant;
  },
}));
