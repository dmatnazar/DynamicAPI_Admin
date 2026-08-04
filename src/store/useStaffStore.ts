import { create } from 'zustand';
import type { StaffMember } from '../types/staff.types';

interface StaffStore {
  staff: StaffMember[];
  activeStaffId: string | null;
  addStaff: (member: StaffMember) => void;
  updateStaff: (id: string, patch: Partial<StaffMember>) => void;
  removeStaff: (id: string) => void;
  setActiveStaff: (id: string | null) => void;
  /** Remove a company from every staff member's access list — call this
   *  from removeTenant flows if you want to keep staff access consistent
   *  when a company is deleted. */
  revokeTenantFromAllStaff: (tenantId: string) => void;
}

export const useStaffStore = create<StaffStore>((set) => ({
  staff: [],
  activeStaffId: null,

  addStaff: (member) =>
    set((s) => ({ staff: [...s.staff, member], activeStaffId: member.id })),

  updateStaff: (id, patch) =>
    set((s) => ({
      staff: s.staff.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    })),

  removeStaff: (id) =>
    set((s) => ({
      staff: s.staff.filter((m) => m.id !== id),
      activeStaffId: s.activeStaffId === id ? null : s.activeStaffId,
    })),

  setActiveStaff: (id) => set({ activeStaffId: id }),

  revokeTenantFromAllStaff: (tenantId) =>
    set((s) => ({
      staff: s.staff.map((m) => ({
        ...m,
        tenantIds: m.tenantIds.filter((t) => t !== tenantId),
      })),
    })),
}));
