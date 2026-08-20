import { create } from 'zustand';
import { toastWarning, toastSuccess } from '../components/ui/Toast';

export interface DeviceProfile {
  id: string;
  token: string;
  name: string;
  hostname: string;
  osPlatform: string;
  osRelease: string;
  ramGb: number;
  cpuModel: string;
  macAddress: string;
  ipAddress: string;
  status: 'pending' | 'approved' | 'blocked' | 'offline';
  tenantId?: string;
  tenantSlug?: string;
  tenantSlugs?: string[];
  companyName?: string;
  companyNames?: string[];
  companySlugs?: string[];
  deviceSyncSecret?: string;
  appVersion: string;
  isNewCompany?: boolean;
}

interface DeviceState {
  profile: DeviceProfile | null;
  loading: boolean;
  checking: boolean;
  error: string | null;
  devicePermission: { granted: boolean; reason?: string } | null;
  statusListeners: Set<() => void>;
  permissionChecking: boolean;
  fetchProfile: () => Promise<DeviceProfile | null>;
  checkStatus: () => Promise<{ ok: boolean; profile?: DeviceProfile; error?: string }>;
  registerDevice: () => Promise<{ ok: boolean; profile?: DeviceProfile; error?: string }>;
  setProfile: (profile: DeviceProfile) => void;
  setError: (error: string | null) => void;
  checkPermission: () => Promise<{ granted: boolean; reason?: string }>;
  requestPermission: () => Promise<{ ok: boolean; error?: string }>;
  subscribeToDeviceStatus: (listener: () => void) => () => void;
  notifyStatusChange: () => void;
  setDevicePermission: (permission: { granted: boolean; reason?: string }) => void;
}

export const useDeviceStore = create<DeviceState>((set, get) => {
  if (typeof window !== 'undefined' && (window as any).deviceAPI?.onStatusChanged) {
    (window as any).deviceAPI.onStatusChanged((profile: DeviceProfile) => {
      const prev = get().profile?.status;
      set({ profile, loading: false });
      if (prev !== profile.status) {
        get().notifyStatusChange();
      }
    });
  }

  // ⚡ Real-time device events from VPS (approved/blocked/deleted)
  if (typeof window !== 'undefined' && (window as any).deviceAPI?.onEvent) {
    (window as any).deviceAPI.onEvent((event: { type: string; deviceId: string; status?: string; companySlugs?: string[]; companyNames?: string[] }) => {
      console.log('[useDeviceStore] Received real-time device event:', event.type);
      set({ error: null });
      if (event.type === 'DEVICE_BLOCKED' || event.type === 'DEVICE_DELETED') {
        const newStatus = event.type === 'DEVICE_BLOCKED' ? 'blocked' : 'blocked';
        set((s) => ({
          profile: s.profile ? { ...s.profile, status: newStatus as any } : s.profile,
          devicePermission: { granted: false, reason: event.type === 'DEVICE_BLOCKED' ? 'blocked' : 'deleted' },
        }));
        get().notifyStatusChange();
      } else if (event.type === 'DEVICE_APPROVED') {
        set((s) => ({
          profile: s.profile
            ? {
                ...s.profile,
                status: 'approved',
                companySlugs: event.companySlugs || s.profile.companySlugs,
                companyNames: event.companyNames || s.profile.companyNames,
              }
            : s.profile,
          devicePermission: { granted: true, reason: 'ok' },
        }));
        get().notifyStatusChange();
      }
    });
  }

  return {
    profile: null,
    loading: true,
    checking: false,
    error: null,
    devicePermission: null,
    statusListeners: new Set(),
    permissionChecking: false,

    fetchProfile: async () => {
      try {
        if ((window as any).deviceAPI?.getProfile) {
          const p = await (window as any).deviceAPI.getProfile();
          set({ profile: p, loading: false });
          get().notifyStatusChange();
          return p;
        }
      } catch (err: any) {
        set({ error: err?.message || 'Profile ýüklenmedi', loading: false });
      }
      return null;
    },

  checkStatus: async () => {
    set({ checking: true, error: null });
    try {
      if ((window as any).deviceAPI?.checkStatus) {
        const res = await (window as any).deviceAPI.checkStatus();
        if (res.ok && res.profile) {
          const prev = get().profile?.status;
          set({ profile: res.profile, checking: false });
          if (prev !== res.profile.status) {
            get().notifyStatusChange();
          }
          return res;
        } else {
          set({ error: res.error || 'Ýagdaý barlap bolmady', checking: false });
          return res;
        }
      }
      return { ok: false, error: 'deviceAPI elýeterli däl' };
    } catch (err: any) {
      const error = err?.message || 'Barlag ýalňyşlygy';
      set({ error, checking: false });
      return { ok: false, error };
    }
  },

  registerDevice: async () => {
    set({ checking: true, error: null });
    try {
      if ((window as any).deviceAPI?.register) {
        const res = await (window as any).deviceAPI.register();
        if (res.ok && res.profile) {
          const prev = get().profile?.status;
          set({ profile: res.profile, checking: false });
          if (prev !== res.profile.status) {
            get().notifyStatusChange();
          }
        } else {
          const errMsg = res.error || 'Registrasiýa şowsuz';
          const debug = res.debug ? ` (${JSON.stringify(res.debug).slice(0, 100)})` : '';
          set({ error: errMsg + debug, checking: false });
        }
        return res;
      }
      return { ok: false, error: 'deviceAPI elýeterli däl' };
    } catch (err: any) {
      const error = err?.message || 'Registrasiýa ýalňyşlygy';
      set({ error, checking: false });
      return { ok: false, error };
    }
  },

  setProfile: (profile: DeviceProfile) => set({ profile }),
  setError: (error: string | null) => set({ error }),

  checkPermission: async () => {
    if (get().permissionChecking) {
      return { granted: false, reason: 'error' };
    }
    set({ permissionChecking: true });
    try {
      if ((window as any).deviceAPI?.checkPermission) {
        const res = await (window as any).deviceAPI.checkPermission();
        const prev = get().devicePermission;

        if (res.permissionGranted) {
          set({ devicePermission: { granted: true, reason: res.reason }, error: null, permissionChecking: false });
          if (prev?.granted === false) {
            toastSuccess('Enjam rugsady', 'Enjamyň girişi dikeldildi.');
          }
          get().notifyStatusChange();
          return { granted: true, reason: res.reason };
        }

        const reason = res.reason || 'error';
        set({ devicePermission: { granted: false, reason }, error: res.error, permissionChecking: false });
        if (prev?.granted !== false) {
          toastWarning('Enjam rugsady', 'Enjamyň girişi gadagan. Administrator bilen habarlaşyň.');
        }
        get().notifyStatusChange();
        return { granted: false, reason };
      }
      set({ permissionChecking: false });
      return { granted: false, reason: 'error' };
    } catch (err: any) {
      const error = err?.message || 'Rugsat barlap bolmady';
      set({ devicePermission: { granted: false, reason: 'error' }, error, permissionChecking: false });
      get().notifyStatusChange();
      return { granted: false, reason: 'error' };
    }
  },

  requestPermission: async () => {
    try {
      if ((window as any).deviceAPI?.requestPermission) {
        const res = await (window as any).deviceAPI.requestPermission();
        if (res.ok) {
          set({ devicePermission: { granted: true }, error: null });
          get().notifyStatusChange();
        }
        return res;
      }
      return { ok: false };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Rugsat soraş bolmady' };
    }
  },

  subscribeToDeviceStatus: (listener: () => void) => {
    const s = get();
    s.statusListeners.add(listener);
    return () => { s.statusListeners.delete(listener); };
  },

  notifyStatusChange: () => {
    const { statusListeners } = get();
    statusListeners.forEach((l) => l());
  },

  setDevicePermission: (permission: { granted: boolean; reason?: string }) => {
    set({ devicePermission: permission });
    get().notifyStatusChange();
  },
  }});
