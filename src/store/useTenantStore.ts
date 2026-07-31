import { create } from 'zustand';
import type { TenantConfig } from '../types/endpoint.types';

interface TenantStore {
  tenants: TenantConfig[];
  activeTenantId: string | null;
  addTenant: (tenant: TenantConfig) => void;
  updateTenant: (id: string, patch: Partial<TenantConfig>) => void;
  removeTenant: (id: string) => void;
  setActiveTenant: (id: string) => void;
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
}));
