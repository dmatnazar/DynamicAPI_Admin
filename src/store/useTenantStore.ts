import { create } from 'zustand';
import type { TenantConfig, TenantConnection } from '../types/endpoint.types';

interface TenantStore {
  tenants: TenantConfig[];
  activeTenantId: string | null;
  addTenant: (tenant: TenantConfig) => void;
  updateTenant: (id: string, patch: Partial<TenantConfig>) => void;
  removeTenant: (id: string) => void;
  setActiveTenant: (id: string | null) => void;

  // Connections CRUD (a company can have several MSSQL connections)
  addConnection: (tenantId: string, connection: TenantConnection) => void;
  updateConnection: (tenantId: string, connectionId: string, patch: Partial<TenantConnection>) => void;
  removeConnection: (tenantId: string, connectionId: string) => void;
  setPrimaryConnection: (tenantId: string, connectionId: string) => void;
}

/** Keeps tenant.dbConnectionString / connectionStatus mirroring the primary connection */
function syncPrimaryMirror(tenant: TenantConfig): TenantConfig {
  const primary = tenant.connections.find((c) => c.isPrimary) ?? tenant.connections[0];
  return {
    ...tenant,
    dbConnectionString: primary?.connectionString ?? '',
    connectionStatus: primary?.connectionStatus ?? 'unknown',
  };
}

export const useTenantStore = create<TenantStore>((set) => ({
  tenants: [],
  activeTenantId: null,

  addTenant: (tenant) =>
    set((s) => ({ tenants: [...s.tenants, tenant], activeTenantId: tenant.id })),

  updateTenant: (id, patch) =>
    set((s) => ({
      tenants: s.tenants.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    })),

  removeTenant: (id) =>
    set((s) => ({
      tenants: s.tenants.filter((t) => t.id !== id),
      activeTenantId: s.activeTenantId === id ? null : s.activeTenantId,
    })),

  setActiveTenant: (id) => set({ activeTenantId: id }),

  addConnection: (tenantId, connection) =>
    set((s) => ({
      tenants: s.tenants.map((t) => {
        if (t.id !== tenantId) return t;
        // The very first connection a company gets always becomes primary.
        const makePrimary = t.connections.length === 0 ? true : connection.isPrimary;
        const nextConnections = [
          ...t.connections.map((c) => (makePrimary ? { ...c, isPrimary: false } : c)),
          { ...connection, isPrimary: makePrimary },
        ];
        return syncPrimaryMirror({ ...t, connections: nextConnections });
      }),
    })),

  updateConnection: (tenantId, connectionId, patch) =>
    set((s) => ({
      tenants: s.tenants.map((t) => {
        if (t.id !== tenantId) return t;
        const nextConnections = t.connections.map((c) =>
          c.id === connectionId ? { ...c, ...patch } : c
        );
        return syncPrimaryMirror({ ...t, connections: nextConnections });
      }),
    })),

  removeConnection: (tenantId, connectionId) =>
    set((s) => ({
      tenants: s.tenants.map((t) => {
        if (t.id !== tenantId) return t;
        const wasPrimary = t.connections.find((c) => c.id === connectionId)?.isPrimary;
        let nextConnections = t.connections.filter((c) => c.id !== connectionId);
        // If we just removed the primary, promote whatever's left so the
        // tenant always has a valid "current" connection when possible.
        if (wasPrimary && nextConnections.length > 0) {
          nextConnections = nextConnections.map((c, i) => ({ ...c, isPrimary: i === 0 }));
        }
        return syncPrimaryMirror({ ...t, connections: nextConnections });
      }),
    })),

  setPrimaryConnection: (tenantId, connectionId) =>
    set((s) => ({
      tenants: s.tenants.map((t) => {
        if (t.id !== tenantId) return t;
        const nextConnections = t.connections.map((c) => ({
          ...c,
          isPrimary: c.id === connectionId,
        }));
        return syncPrimaryMirror({ ...t, connections: nextConnections });
      }),
    })),
}));
