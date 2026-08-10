/**
 * Central sync engine: full sync + persistent offline queue.
 * Runs on startup, on interval, and after every local change.
 */
import { syncToVps, syncStaffToVps, checkGatewayHealth, fetchCatalogFromVps } from './api';
import { useTenantStore } from '../store/useTenantStore';
import { useStaffStore } from '../store/useStaffStore';
import { useEndpointStore } from '../store/useEndpointStore';
import { toastSuccess, toastError, toastWarning, toastInfo } from '../components/ui/Toast';

export type SyncStatusSnapshot = {
  running: boolean;
  lastSuccessAt?: string;
  lastAttemptAt?: string;
  lastError?: string;
  lastResult?: string;
  nextSyncAt?: string;
  queueLength: number;
  online: boolean | null;
  intervalSec: number;
};

type Listener = (s: SyncStatusSnapshot) => void;

const listeners = new Set<Listener>();
let running = false;
let timer: ReturnType<typeof setInterval> | null = null;
let intervalSec = 30;
let lastNotifyFingerprint = '';
let lastOfflineToast = 0;
let lastSnapshot: SyncStatusSnapshot = {
  running: false,
  queueLength: 0,
  online: null,
  intervalSec: 30,
};

function emit(partial: Partial<SyncStatusSnapshot> = {}) {
  lastSnapshot = { ...lastSnapshot, ...partial, running };
  for (const l of listeners) l(lastSnapshot);
}

export function subscribeSyncStatus(fn: Listener): () => void {
  listeners.add(fn);
  fn(lastSnapshot);
  return () => listeners.delete(fn);
}

export function getSyncStatus(): SyncStatusSnapshot {
  return lastSnapshot;
}

async function getCreds(): Promise<{ gatewayUrl: string; adminSecret: string } | null> {
  try {
    const s = await window.dbAPI?.getSettings?.();
    if (s?.gatewayUrl && s?.adminSecret) return { gatewayUrl: s.gatewayUrl, adminSecret: s.adminSecret };
    const gatewayUrl = await window.vaultAPI?.get?.('gatewayUrl');
    const adminSecret = await window.vaultAPI?.get?.('adminSyncSecret');
    if (gatewayUrl && adminSecret) return { gatewayUrl, adminSecret };
  } catch {
    /* ignore */
  }
  return null;
}

async function refreshMeta() {
  try {
    const meta = await window.dbAPI?.getSyncMeta?.();
    const queue = (await window.dbAPI?.listSyncQueue?.()) || [];
    if (meta?.autoSyncIntervalSec) intervalSec = meta.autoSyncIntervalSec;
    const next =
      meta?.lastSuccessAt || meta?.lastAttemptAt
        ? new Date(
            (meta.lastSuccessAt ? new Date(meta.lastSuccessAt).getTime() : Date.now()) +
              intervalSec * 1000
          ).toISOString()
        : new Date(Date.now() + intervalSec * 1000).toISOString();
    emit({
      lastSuccessAt: meta?.lastSuccessAt,
      lastAttemptAt: meta?.lastAttemptAt,
      lastError: meta?.lastError,
      lastResult: meta?.lastResult,
      queueLength: queue.filter((q) => q.status === 'pending' || q.status === 'failed').length,
      intervalSec,
      nextSyncAt: next,
    });
  } catch {
    /* ignore */
  }
}

/** Enqueue work — survives offline + restart */
export async function enqueueChange(
  type: 'full-sync' | 'staff' | 'endpoints' | 'tenant',
  tenantSlug?: string
) {
  try {
    await window.dbAPI?.enqueueSync?.({ type, tenantSlug });
    await refreshMeta();
    // try immediate process (non-blocking)
    void processQueue();
  } catch (err) {
    console.warn('[sync] enqueue failed', err);
  }
}

async function syncStaffAll(creds: { gatewayUrl: string; adminSecret: string }): Promise<string[]> {
  const tenants = useTenantStore.getState().tenants;
  const allStaff = useStaffStore.getState().staff;
  const syncedUsernames: string[] = [];

  for (const t of tenants) {
    const related = allStaff.filter((s) => s.tenantIds.includes(t.id));
    const pushable = related.filter(
      (s) =>
        s.passwordHash &&
        !s.passwordHash.startsWith('synced-from-bi') &&
        !s.passwordHash.startsWith('pending-reset') &&
        !s.passwordHash.endsWith(':0000')
    );
    if (pushable.length === 0) continue;

    const payload = [];
    for (const s of pushable) {
      let passwordPlain: string | undefined;
      if (s.passwordEnc && window.staffAPI?.decryptSecret) {
        try {
          passwordPlain = (await window.staffAPI.decryptSecret(s.passwordEnc)) || undefined;
        } catch { /* */ }
      }
      payload.push({
        id: s.id,
        fullName: s.fullName,
        username: s.username,
        passwordHash: s.passwordHash,
        role: s.role,
        tenantSlugs: tenants.filter((x) => s.tenantIds.includes(x.id)).map((x) => x.slug),
        phone: s.phone,
        email: s.email,
        active: s.active,
        passwordPlain,
      });
    }
    await syncStaffToVps(creds.gatewayUrl, creds.adminSecret, t.slug, payload);
    for (const s of pushable) {
      if (s.active && !syncedUsernames.includes(s.username)) syncedUsernames.push(s.username);
    }
  }
  return syncedUsernames;
}

async function syncEndpointsAll(creds: { gatewayUrl: string; adminSecret: string }) {
  const tenants = useTenantStore.getState().tenants;
  const byTenant = useEndpointStore.getState().endpointsByTenant;

  for (const t of tenants) {
    const endpoints = byTenant[t.id] || [];
    if (t.connections.length === 0 && endpoints.length === 0) continue;
    await syncToVps(creds.gatewayUrl, creds.adminSecret, t, endpoints, true);
  }
}


/** Merge staff from VPS into local Electron store (BI → Electron) */
async function pullStaffFromVps(creds: { gatewayUrl: string; adminSecret: string }) {
  try {
    const catalog = await fetchCatalogFromVps(creds.gatewayUrl, creds.adminSecret);
    const tenants = useTenantStore.getState().tenants;
    const slugToId = new Map(tenants.map((t) => [t.slug, t.id]));
    const local = useStaffStore.getState().staff;
    const byUser = new Map(local.map((s) => [s.username.toLowerCase(), s]));

    for (const rs of catalog.staff || []) {
      const key = String(rs.username || '').toLowerCase();
      if (!key) continue;
      const tenantId = slugToId.get(rs.tenantSlug);
      const existing = byUser.get(key);
      if (existing) {
        const hash =
          rs.passwordHash && !String(rs.passwordHash).startsWith('synced-from-bi')
            ? rs.passwordHash
            : existing.passwordHash;
        const patched = {
          ...existing,
          fullName: rs.fullName || existing.fullName,
          phone: rs.phone ?? existing.phone,
          email: rs.email ?? existing.email,
          role: (rs.role as any) || existing.role,
          active: rs.active !== false,
          passwordHash: hash,
          tenantIds:
            tenantId && !existing.tenantIds.includes(tenantId)
              ? [...existing.tenantIds, tenantId]
              : existing.tenantIds,
        };
        useStaffStore.setState((s) => ({
          staff: s.staff.map((m) => (m.id === existing.id ? patched : m)),
        }));
        void window.dbAPI?.upsertStaff?.({ ...patched, updatedAt: new Date().toISOString() });
      } else if (tenantId) {
        // New staff from BI
        const member = {
          id: rs.id || `vps-${key}`,
          fullName: rs.fullName || key,
          username: rs.username,
          passwordHash: rs.passwordHash || 'synced-from-bi:keep',
          role: (rs.role as any) || 'viewer',
          tenantIds: [tenantId],
          active: rs.active !== false,
          phone: rs.phone,
          email: rs.email,
          createdAt: new Date().toISOString(),
        };
        // Direct store mutate without re-enqueue storm: use addStaff would enqueue
        useStaffStore.setState((s) => ({ staff: [...s.staff, member as any] }));
        void window.dbAPI?.upsertStaff?.({ ...member, updatedAt: new Date().toISOString() });
      }
    }
  } catch (err) {
    console.warn('[sync] pull staff failed', err);
  }
}

async function runFullSync(creds: { gatewayUrl: string; adminSecret: string }) {
  await syncEndpointsAll(creds);
  const users = await syncStaffAll(creds);
  await pullStaffFromVps(creds);
  return users;
}


/** Process pending queue items + optional forced full sync */
export async function processQueue(opts?: { forceFull?: boolean }): Promise<{
  ok: boolean;
  message: string;
}> {
  if (running) return { ok: false, message: 'Sync eýýäm işleýär' };
  running = true;
  emit({ running: true });

  const now = new Date().toISOString();
  try {
    await window.dbAPI?.updateSyncMeta?.({ lastAttemptAt: now });

    const creds = await getCreds();
    if (!creds) {
      const msg = 'Gateway URL / Admin Secret ýok — Settings-de dolduryň';
      await window.dbAPI?.updateSyncMeta?.({ lastError: msg, lastAttemptAt: now });
      emit({ online: false, lastError: msg, lastAttemptAt: now });
      return { ok: false, message: msg };
    }

    const online = await checkGatewayHealth(creds.gatewayUrl);
    emit({ online });
    if (!online) {
      // Ensure full-sync is queued for later
      await window.dbAPI?.enqueueSync?.({ type: 'full-sync' });
      const msg = 'VPS offline — queue-da saklandy';
      await window.dbAPI?.updateSyncMeta?.({ lastError: msg, lastAttemptAt: now });
      emit({ lastError: msg, lastAttemptAt: now });
      await refreshMeta();
      if (Date.now() - lastOfflineToast > 120_000) {
        lastOfflineToast = Date.now();
        toastWarning('Internet / VPS ýok', 'Üýtgeşmeler queue-da saklandy. Online bolansoň awto-sync eder.');
      }
      return { ok: false, message: msg };
    }

    if (opts?.forceFull) {
      await window.dbAPI?.enqueueSync?.({ type: 'full-sync' });
    }

    const queue = ((await window.dbAPI?.listSyncQueue?.()) || []).filter(
      (q) => q.status === 'pending' || q.status === 'failed'
    );

    // Prefer a single full-sync if present
    const full = queue.find((q) => q.type === 'full-sync');
    const items = full ? [full] : queue;

    if (items.length === 0 && opts?.forceFull) {
      await runFullSync(creds);
    } else if (items.length === 0) {
      // Heartbeat full sync to keep VPS in parity
      await runFullSync(creds);
    } else {
      for (const item of items) {
        await window.dbAPI?.updateSyncQueueItem?.(item.id, {
          status: 'processing',
          attempts: (item.attempts || 0) + 1,
        });
        try {
          if (item.type === 'full-sync') {
            await runFullSync(creds);
          } else if (item.type === 'staff') {
            await syncStaffAll(creds);
          } else if (item.type === 'endpoints' || item.type === 'tenant') {
            if (item.tenantSlug) {
              const t = useTenantStore.getState().tenants.find((x) => x.slug === item.tenantSlug);
              if (t) {
                const endpoints =
                  useEndpointStore.getState().endpointsByTenant[t.id] || [];
                await syncToVps(creds.gatewayUrl, creds.adminSecret, t, endpoints, true);
              }
            } else {
              await syncEndpointsAll(creds);
            }
            if (item.type === 'tenant') await syncStaffAll(creds);
          }
          await window.dbAPI?.removeSyncQueueItem?.(item.id);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          await window.dbAPI?.updateSyncQueueItem?.(item.id, {
            status: 'failed',
            lastError: errMsg,
          });
          throw err;
        }
      }
    }

    // Ensure staff pushed and collect usernames for notification
    let syncedUsers: string[] = [];
    try {
      syncedUsers = await syncStaffAll(creds);
    } catch {
      /* already synced in full */
    }

    const okMsg = `Sync üstünlikli · ${new Date().toLocaleTimeString()}`;
    await window.dbAPI?.updateSyncMeta?.({
      lastSuccessAt: new Date().toISOString(),
      lastAttemptAt: new Date().toISOString(),
      lastError: undefined,
      lastResult: okMsg,
    });
    await refreshMeta();
    emit({
      lastSuccessAt: new Date().toISOString(),
      lastError: undefined,
      lastResult: okMsg,
      online: true,
    });

    const fp = `ok:${syncedUsers.slice().sort().join(',')}`;
    if (fp !== lastNotifyFingerprint) {
      lastNotifyFingerprint = fp;
      if (syncedUsers.length > 0) {
        toastSuccess(
          'BI Platform-a giriş taýýar',
          syncedUsers.length === 1
            ? `@${syncedUsers[0]} indiki login/parol bilen BI-e girip bilýär.`
            : `${syncedUsers.length} işgär VPS-e ýazyldy:\n` +
                syncedUsers.slice(0, 8).map((u) => `• @${u}`).join('\n') +
                (syncedUsers.length > 8 ? `\n… +${syncedUsers.length - 8}` : '')
        );
      }
    }

    return { ok: true, message: okMsg };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await window.dbAPI?.enqueueSync?.({ type: 'full-sync' });
    await window.dbAPI?.updateSyncMeta?.({
      lastError: errMsg,
      lastAttemptAt: new Date().toISOString(),
    });
    await refreshMeta();
    emit({ lastError: errMsg, online: false });
    toastError('Sync şowsuz', errMsg.slice(0, 120));
    return { ok: false, message: errMsg };
  } finally {
    running = false;
    emit({ running: false });
    // schedule next
    const next = new Date(Date.now() + intervalSec * 1000).toISOString();
    emit({ nextSyncAt: next });
  }
}

/** Start auto-sync loop (call once after hydrate) */
async function resolveIntervalSec(): Promise<number> {
  try {
    const meta = await window.dbAPI?.getSyncMeta?.();
    if (meta?.autoSyncIntervalSec != null) return Number(meta.autoSyncIntervalSec);
    const v = await window.vaultAPI?.get?.('autoSyncSeconds');
    if (v != null && v !== '') return Number(v);
    const legacy = await window.vaultAPI?.get?.('autoSyncMinutes');
    if (legacy != null && legacy !== '') return Number(legacy);
  } catch { /* */ }
  return 30;
}

function armTimer(sec: number) {
  if (timer) clearInterval(timer);
  timer = null;
  intervalSec = sec > 0 ? sec : 30;
  emit({ intervalSec });
  if (sec <= 0) return; // manual only
  timer = setInterval(() => {
    void processQueue();
  }, intervalSec * 1000);
}

export function startAutoSync() {
  void (async () => {
    const sec = await resolveIntervalSec();
    armTimer(sec);
    await refreshMeta();
    await window.dbAPI?.enqueueSync?.({ type: 'full-sync' });
    await processQueue({ forceFull: true });
  })();

  window.addEventListener('sync-interval-changed', ((e: CustomEvent) => {
    const sec = Number(e.detail?.sec) || 30;
    armTimer(sec);
    void window.dbAPI?.updateSyncMeta?.({ autoSyncIntervalSec: sec });
  }) as EventListener);
}

export function stopAutoSync() {
  if (timer) clearInterval(timer);
  timer = null;
}

export async function manualSync() {
  return processQueue({ forceFull: true });
}
