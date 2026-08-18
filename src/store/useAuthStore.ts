import { create } from 'zustand';

export type ElectronUserRole = 'viewer' | 'editor' | 'manager' | 'admin';

export interface ElectronSessionUser {
  id: string;
  username: string;
  fullName: string;
  role: ElectronUserRole;
  companyId?: string;
  companySlug?: string;
  companyName?: string;
  isSuperAdmin?: boolean;
}

interface AuthState {
  user: ElectronSessionUser | null;
  isAuthenticated: boolean;
  login: (user: ElectronSessionUser) => void;
  logout: () => void;
}

const STORAGE_KEY = 'electron_session_user';

function getInitialUser(): ElectronSessionUser | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    /* ignore */
  }
  return null;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: getInitialUser(),
  isAuthenticated: !!getInitialUser(),

  login: (user: ElectronSessionUser) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } catch {
      /* ignore */
    }
    set({ user, isAuthenticated: true });
  },

  logout: () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    set({ user: null, isAuthenticated: false });
  },
}));
