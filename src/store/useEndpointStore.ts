import { create } from 'zustand';
import type { EndpointConfig } from '../types/endpoint.types';

interface EndpointStore {
  // tenantId -> endpoints
  endpointsByTenant: Record<string, EndpointConfig[]>;
  activeEndpointId: string | null;
  addEndpoint: (tenantId: string, endpoint: EndpointConfig) => void;
  updateEndpoint: (tenantId: string, id: string, patch: Partial<EndpointConfig>) => void;
  removeEndpoint: (tenantId: string, id: string) => void;
  setActiveEndpoint: (id: string | null) => void;
}

export const useEndpointStore = create<EndpointStore>((set) => ({
  endpointsByTenant: {},
  activeEndpointId: null,
  addEndpoint: (tenantId, endpoint) =>
    set((s) => ({
      endpointsByTenant: {
        ...s.endpointsByTenant,
        [tenantId]: [...(s.endpointsByTenant[tenantId] ?? []), endpoint],
      },
      activeEndpointId: endpoint.id,
    })),
  updateEndpoint: (tenantId, id, patch) =>
    set((s) => ({
      endpointsByTenant: {
        ...s.endpointsByTenant,
        [tenantId]: (s.endpointsByTenant[tenantId] ?? []).map((e) =>
          e.id === id ? { ...e, ...patch } : e
        ),
      },
    })),
  removeEndpoint: (tenantId, id) =>
    set((s) => ({
      endpointsByTenant: {
        ...s.endpointsByTenant,
        [tenantId]: (s.endpointsByTenant[tenantId] ?? []).filter((e) => e.id !== id),
      },
    })),
  setActiveEndpoint: (id) => set({ activeEndpointId: id }),
}));
