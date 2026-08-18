export type StaffRole = 'viewer' | 'editor' | 'manager' | 'admin';

export interface StaffMember {
  id: string;
  fullName: string;
  username: string;
  /** "<saltHex>:<hashHex>" produced by window.staffAPI.hashPassword (scrypt, main process) */
  passwordHash: string;
  /** OS-encrypted plain password for admin view (safeStorage) */
  passwordEnc?: string;
  role: StaffRole;
  /** IDs of TenantConfig this staff member is allowed to see/work on */
  tenantIds: string[];
  active: boolean;
  createdAt: string;
  /** Contact fields (synced to BI via VPS) */
  phone?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}
