import { create } from 'zustand';
import type { StaffMember } from '../types/staff.types';
import { enqueueChange } from '../lib/syncEngine';
import { toastInfo, toastWarning } from '../components/ui/Toast';

interface StaffStore {
  staff: StaffMember[];
  activeStaffId: string | null;
  addStaff: (member: StaffMember) => void;
  updateStaff: (id: string, patch: Partial<StaffMember>) => void;
  removeStaff: (id: string) => void;
  setActiveStaff: (id: string | null) => void;
  revokeTenantFromAllStaff: (tenantId: string) => void;
}

async function persist(member: StaffMember) {
  if (!window.dbAPI) return;
  await window.dbAPI.upsertStaff({
    ...member,
    updatedAt: new Date().toISOString(),
  });
}

export const useStaffStore = create<StaffStore>((set, get) => ({
  staff: [],
  activeStaffId: null,

  addStaff: (member) => {
    set((s) => ({ staff: [...s.staff, member], activeStaffId: member.id }));
    void persist(member);
    toastInfo(
      'Işgär saklandy',
      `@${member.username} local DB-de. VPS sync soň BI Platform-a girip biler.`
    );
    void enqueueChange('staff');
  },

  updateStaff: (id, patch) => {
    set((s) => ({
      staff: s.staff.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }));
    const m = get().staff.find((x) => x.id === id);
    if (m) void persist(m);
    void enqueueChange('staff');
  },

  removeStaff: (id) => {
    set((s) => ({
      staff: s.staff.filter((m) => m.id !== id),
      activeStaffId: s.activeStaffId === id ? null : s.activeStaffId,
    }));
    void window.dbAPI?.deleteStaff?.(id);
    void enqueueChange('staff');
  },

  setActiveStaff: (id) => set({ activeStaffId: id }),

  revokeTenantFromAllStaff: (tenantId) => {
    set((s) => ({
      staff: s.staff.map((m) => ({
        ...m,
        tenantIds: m.tenantIds.filter((t) => t !== tenantId),
      })),
    }));
    for (const m of get().staff) void persist(m);
    void enqueueChange('staff');
  },
}));
