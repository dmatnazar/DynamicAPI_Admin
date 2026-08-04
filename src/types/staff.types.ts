export type StaffRole = 'admin' | 'editor' | 'viewer';

export interface StaffMember {
  id: string;
  fullName: string;
  username: string;
  /** "<saltHex>:<hashHex>" produced by window.staffAPI.hashPassword (scrypt, main process) */
  passwordHash: string;
  role: StaffRole;
  /** IDs of TenantConfig this staff member is allowed to see/work on */
  tenantIds: string[];
  active: boolean;
  createdAt: string;
}
