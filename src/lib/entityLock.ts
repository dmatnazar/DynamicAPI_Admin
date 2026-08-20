import { entityLockOnVps } from './api';
import { toastWarning } from '../components/ui/Toast';
import { useDeviceStore } from '../store/useDeviceStore';

const LOCK_TTL_MS = 10 * 60 * 1000;
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const heartbeats = new Map<string, ReturnType<typeof setInterval>>();

function key(entityType: string, entityId: string) {
  return `${entityType}:${entityId}`;
}

async function getCreds(): Promise<{ gatewayUrl: string; deviceId: string; deviceSecret: string } | null> {
  try {
    const profile = useDeviceStore.getState().profile;
    const deviceSecret = profile?.deviceSyncSecret;
    if (!deviceSecret) return null;
    const settings = await window.dbAPI?.getSettings?.();
    if (settings?.gatewayUrl) {
      return { gatewayUrl: settings.gatewayUrl, deviceId: profile.id, deviceSecret };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export async function acquireEntityLock(opts: {
  entityType: 'tenant' | 'staff' | 'endpoint';
  entityId: string;
  openedBy?: string;
}): Promise<boolean> {
  const creds = await getCreds();
  if (!creds) {
    // Offline / no settings — allow local edit
    return true;
  }
  try {
    const r = await entityLockOnVps(creds.gatewayUrl, creds.deviceId, creds.deviceSecret, {
      ...opts,
      action: 'lock',
      openedBy: opts.openedBy || 'electron',
    });
    // Only hard-block when another user holds the lock
    if (!r.ok && r.status === 423) {
      toastWarning(
        'Üýtgetmek mümkin däl',
        r.body?.message || 'Bu ýazgy başga ýerde açyk (is_open).'
      );
      return false;
    }
    // Network / other errors → still allow local edit
    if (!r.ok) {
      console.warn('[lock] acquire failed, allowing local edit', r.status, r.body);
      return true;
    }
  } catch (e) {
    console.warn('[lock] acquire error, allowing local edit', e);
    return true;
  }

  const k = key(opts.entityType, opts.entityId);
  clearEntityLockTimers(k);

  timers.set(
    k,
    setTimeout(() => {
      void releaseEntityLock(opts);
      toastWarning('Lock gutardy', '10 minut içinde saklanmady — is_open = false');
    }, LOCK_TTL_MS)
  );

  heartbeats.set(
    k,
    setInterval(() => {
      void entityLockOnVps(creds.gatewayUrl, creds.deviceId, creds.deviceSecret, {
        ...opts,
        action: 'heartbeat',
        openedBy: opts.openedBy || 'electron',
      }).catch(() => {});
    }, 2 * 60 * 1000)
  );

  return true;
}

export async function releaseEntityLock(opts: {
  entityType: 'tenant' | 'staff' | 'endpoint';
  entityId: string;
  openedBy?: string;
}): Promise<void> {
  const k = key(opts.entityType, opts.entityId);
  clearEntityLockTimers(k);
  const creds = await getCreds();
  if (!creds) return;
  try {
    await entityLockOnVps(creds.gatewayUrl, creds.deviceId, creds.deviceSecret, {
      ...opts,
      action: 'unlock',
      openedBy: opts.openedBy || 'electron',
    });
  } catch {
    /* ignore */
  }
}

function clearEntityLockTimers(k: string) {
  const t = timers.get(k);
  if (t) clearTimeout(t);
  timers.delete(k);
  const h = heartbeats.get(k);
  if (h) clearInterval(h);
  heartbeats.delete(k);
}
