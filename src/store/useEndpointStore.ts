import { create } from 'zustand';
import type { EndpointConfig } from '../types/endpoint.types';

interface EndpointStore {
  endpointsByTenant: Record<string, EndpointConfig[]>;
  activeEndpointId: string | null;
  addEndpoint: (tenantId: string, endpoint: EndpointConfig) => void;
  updateEndpoint: (tenantId: string, id: string, patch: Partial<EndpointConfig>) => void;
  removeEndpoint: (tenantId: string, id: string) => void;
  setActiveEndpoint: (id: string | null) => void;
}

async function persist(companyId: string, ep: EndpointConfig) {
  if (!window.dbAPI) return;
  const now = new Date().toISOString();
  await window.dbAPI.upsertEndpoint({
    id: ep.id,
    companyId,
    connectionId: ep.connectionId,
    name: ep.name,
    method: ep.method,
    pathTemplate: ep.pathTemplate,
    sqlQuery: ep.sqlQuery,
    paramsSchema: ep.paramsSchema,
    responseSchema: ep.responseSchema,
    cacheTtlSec: ep.cacheTtlSec,
    authRequired: ep.authRequired,
    createdAt: now,
    updatedAt: now,
  });
}

export const useEndpointStore = create<EndpointStore>((set, get) => ({
  endpointsByTenant: {},
  activeEndpointId: null,

  addEndpoint: (tenantId, endpoint) => {
    set((s) => ({
      endpointsByTenant: {
        ...s.endpointsByTenant,
        [tenantId]: [...(s.endpointsByTenant[tenantId] ?? []), endpoint],
      },
      activeEndpointId: endpoint.id,
    }));
    void persist(tenantId, endpoint);
  },

  updateEndpoint: (tenantId, id, patch) => {
    set((s) => ({
      endpointsByTenant: {
        ...s.endpointsByTenant,
        [tenantId]: (s.endpointsByTenant[tenantId] ?? []).map((e) =>
          e.id === id ? { ...e, ...patch } : e
        ),
      },
    }));
    const ep = get().endpointsByTenant[tenantId]?.find((e) => e.id === id);
    if (ep) void persist(tenantId, ep);
  },

  removeEndpoint: (tenantId, id) => {
    set((s) => ({
      endpointsByTenant: {
        ...s.endpointsByTenant,
        [tenantId]: (s.endpointsByTenant[tenantId] ?? []).filter((e) => e.id !== id),
      },
    }));
    void window.dbAPI?.deleteEndpoint(id);
  },

  setActiveEndpoint: (id) => set({ activeEndpointId: id }),
}));
