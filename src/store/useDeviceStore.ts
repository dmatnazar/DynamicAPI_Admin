import { create } from 'zustand';

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
  companyName?: string;
  appVersion: string;
}

interface DeviceState {
  profile: DeviceProfile | null;
  loading: boolean;
  checking: boolean;
  error: string | null;
  fetchProfile: () => Promise<DeviceProfile | null>;
  checkStatus: () => Promise<{ ok: boolean; profile?: DeviceProfile; error?: string }>;
  registerDevice: () => Promise<{ ok: boolean; profile?: DeviceProfile; error?: string }>;
  setProfile: (profile: DeviceProfile) => void;
}

export const useDeviceStore = create<DeviceState>((set, get) => ({
  profile: null,
  loading: true,
  checking: false,
  error: null,

  fetchProfile: async () => {
    try {
      if ((window as any).deviceAPI?.getProfile) {
        const p = await (window as any).deviceAPI.getProfile();
        set({ profile: p, loading: false });
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
          set({ profile: res.profile, checking: false });
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
          set({ profile: res.profile, checking: false });
        } else {
          set({ error: res.error || 'Registrasiýa şowsuz', checking: false });
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
}));
