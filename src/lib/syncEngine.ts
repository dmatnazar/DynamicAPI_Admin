/**
 * Central sync engine: full sync + persistent offline queue.
 * Runs on startup, on interval, and after every local change.
 */
import { syncToVps, syncStaffToVps, checkGatewayHealth, fetchCatalogFromVps, deactivateTenantOnVps, deleteTenantOnVps, ensureTenantOnVps } from './api';
import type { TenantConfig } from '../types/endpoint.types';
import { useTenantStore } from '../store/useTenantStore';
import { useStaffStore, recentlyDeletedUsernames } from '../store/useStaffStore';
import { useEndpointStore } from '../store/useEndpointStore';
import { useDeviceStore } from '../store/useDeviceStore';
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
let syncEnabled = false;
let lastSnapshot: SyncStatusSnapshot = {
  running: false,
  queueLength: 0,
  online: null,
  intervalSec: 30,
};

export async function isSyncEnabled(): Promise<boolean> {
  try {
    const v = await window.vaultAPI?.get?.('syncEnabled');
    return v === '1' || v === 'true';
  } catch {
    return false;
  }
}

export async function setSyncEnabled(value: boolean): Promise<void> {
  try {
    await window.vaultAPI?.set?.('syncEnabled', value ? '1' : '0');
    syncEnabled = value;
  } catch {
    /* ignore */
  }
}

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

/**
 * Electron signs ALL VPS requests with device_sync_secret (devices.device_sync_secret on VPS).
 * Never use ADMIN_SYNC_SECRET / adminSyncSecret here — that is BI ↔ VPS only.
 */
async function getCreds(): Promise<{ gatewayUrl: string; deviceId: string; deviceSecret: string } | null> {
  try {
    const profile = useDeviceStore.getState().profile;
    const deviceId = profile?.id || '';
    const deviceSecret = profile?.deviceSyncSecret || '';
    if (!deviceId || !deviceSecret) {
      console.warn('[sync] deviceId/deviceSyncSecret missing — device must be approved first');
      return null;
    }

    let gatewayUrl =
      (await window.vaultAPI?.get?.('gatewayUrl')) ||
      (await window.dbAPI?.getSettings?.())?.gatewayUrl ||
      '';
    gatewayUrl = String(gatewayUrl || '').trim().replace(/\/$/, '');
    if (!gatewayUrl) {
      console.warn('[sync] gatewayUrl missing in settings');
      return null;
    }

    return { gatewayUrl, deviceId, deviceSecret };
  } catch (e) {
    console.warn('[sync] getCreds failed', e);
    return null;
  }
}

async function getDeviceCreds(): Promise<{ gatewayUrl: string; deviceSecret: string } | null> {
  const c = await getCreds();
  if (!c) return null;
  return { gatewayUrl: c.gatewayUrl, deviceSecret: c.deviceSecret };
}

async function checkDevicePermission(): Promise<{ allowed: boolean; reason?: string }> {
  try {
    if ((window as any).deviceAPI?.checkPermission) {
      const res = await (window as any).deviceAPI.checkPermission();
      if (res.permissionGranted) {
        useDeviceStore.getState().setDevicePermission({ granted: true, reason: res.reason });
        return { allowed: true };
      }
      const reason = res.reason || res.error || 'unknown';
      useDeviceStore.getState().setDevicePermission({ granted: false, reason });
      return { allowed: false, reason };
    }
  } catch {
    // ignore permission check failures and allow sync to proceed
  }
  return { allowed: true };
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
  type: 'full-sync' | 'staff' | 'endpoints' | 'tenant' | 'tenant-delete',
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

/** Tenants eligible to be pushed to the VPS — passive (isActive === false) companies are local-only.
 *  Only tenants explicitly assigned to this device are synced. If no assignments exist, returns empty array.
 *  Caller should ensure device status has been checked before syncing. */
export function getActiveTenants(): TenantConfig[] {
  const all = useTenantStore.getState().tenants.filter((t) => t.isActive !== false);
  try {
    const profile = useDeviceStore.getState().profile;
    const assignedSlugs = profile?.companySlugs || profile?.tenantSlugs || [];
    if (assignedSlugs.length > 0) {
      return all.filter((t) => assignedSlugs.includes(t.slug));
    }
  } catch {
    /* ignore */
  }
  return [];
}

export function getDeviceAssignedSlugs(): string[] {
  try {
    const profile = useDeviceStore.getState().profile;
    return profile?.companySlugs || profile?.tenantSlugs || [];
  } catch {
    return [];
  }
}

export function isDeviceAssignmentReady(): boolean {
  try {
    const profile = useDeviceStore.getState().profile;
    if (!profile) return false;
    const slugs = profile.companySlugs || profile.tenantSlugs || [];
    return slugs.length > 0 && profile.status === 'approved';
  } catch {
    return false;
  }
}

async function syncStaffAll(creds: { gatewayUrl: string; deviceId: string; deviceSecret: string }): Promise<string[]> {
  const tenants = getActiveTenants();
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

    // Ensure tenant exists on VPS before syncing staff
    try {
      const ensured = await ensureTenantOnVps(creds.gatewayUrl, creds.deviceId, creds.deviceSecret, t);
      if (!ensured.ok) {
        toastWarning(`${t.name || t.slug}`, 'Bu kärhana VPS-de döredip bolmady. Staff sync edilmedi.');
        continue;
      }
    } catch (e: any) {
      toastWarning(`${t.name || t.slug}`, `Kärhana barlag bolmady: ${e?.message || 'Bilinmäýän ýalňyşlyk'}`);
      continue;
    }

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
    try {
      await syncStaffToVps(creds.gatewayUrl, creds.deviceId, creds.deviceSecret, t.slug, payload);
      for (const s of pushable) {
        if (s.active && !syncedUsernames.includes(s.username)) syncedUsernames.push(s.username);
      }
    } catch (e: any) {
      toastWarning(`Sync şowsuz: ${t.name || t.slug}`, e?.message || 'Bilinmäýän ýalňyşlyk');
    }
  }
  return syncedUsernames;
}

async function syncEndpointsAll(creds: { gatewayUrl: string; deviceId: string; deviceSecret: string }) {
  const tenants = getActiveTenants();
  const byTenant = useEndpointStore.getState().endpointsByTenant;

  for (const t of tenants) {
    const endpoints = byTenant[t.id] || [];
    const hasConnection = t.connections.length > 0;
    if (!hasConnection && endpoints.length === 0) continue;
    if (!hasConnection) {
      toastWarning(
        `${t.name || t.slug}`,
        'Bu kärhanada database baglanyşygy ýok. Endpointler sync edilmedi.'
      );
      continue;
    }

    // Ensure tenant exists on VPS before syncing endpoints
    try {
      const ensured = await ensureTenantOnVps(creds.gatewayUrl, creds.deviceId, creds.deviceSecret, t);
      if (!ensured.ok) {
        toastWarning(`${t.name || t.slug}`, 'Bu kärhana VPS-de döredip bolmady. Endpointler sync edilmedi.');
        continue;
      }
    } catch (e: any) {
      toastWarning(`${t.name || t.slug}`, `Kärhana barlag bolmady: ${e?.message || 'Bilinmäýän ýalňyşlyk'}`);
      continue;
    }

    try {
      await syncToVps(creds.gatewayUrl, creds.deviceId, creds.deviceSecret, t, endpoints, true);
    } catch (e: any) {
      toastWarning(`Sync şowsuz: ${t.name || t.slug}`, e?.message || 'Bilinmäýän ýalňyşlyk');
    }
  }
}


/** Merge catalog (tenants, endpoints, staff) from VPS into local Electron stores (BI → Electron) */
async function pullCatalogFromVps(creds: { gatewayUrl: string; deviceId: string; deviceSecret: string }) {
  try {
    const catalog = await fetchCatalogFromVps(creds.gatewayUrl, creds.deviceId, creds.deviceSecret);
    const tenants = useTenantStore.getState().tenants;
    const slugToId = new Map(tenants.map((t) => [t.slug, t.id]));

    // Only pull data for tenants assigned to this device
    const assignedSlugs = new Set<string>();
    try {
      const profile = useDeviceStore.getState().profile;
      const slugs = profile?.companySlugs || profile?.tenantSlugs || [];
      slugs.forEach((s) => assignedSlugs.add(s));
    } catch {
      /* ignore */
    }

    // 1. Merge Tenants (Companies) — only ACTIVE tenants are pulled from the VPS catalog.
    //    Passive VPS tenants are skipped; the local isActive toggle is the source of truth,
    //    so an existing passive company is never re-activated from the VPS side.
    for (const ct of catalog.tenants || []) {
      if (ct.isActive === false) continue;
      if (assignedSlugs.size > 0 && !assignedSlugs.has(ct.slug)) continue;
      const existing = tenants.find((t) => t.slug === ct.slug || t.id === ct.id);
      if (existing) {
        let changed = false;
        const patch: Partial<typeof existing> = {};
        if (ct.name && ct.name !== existing.name) {
          patch.name = ct.name;
          changed = true;
        }
        // Preserve local toggle: never re-activate a locally-passive company from the VPS.
        if (
          typeof ct.isActive === 'boolean' &&
          ct.isActive !== existing.isActive &&
          existing.isActive !== false
        ) {
          patch.isActive = ct.isActive;
          changed = true;
        }
        if (changed) {
          const updated = { ...existing, ...patch };
          useTenantStore.setState((s) => ({
            tenants: s.tenants.map((t) => (t.id === existing.id ? updated : t)),
          }));
          void window.dbAPI?.upsertCompany?.({
            id: updated.id,
            slug: updated.slug,
            name: updated.name,
            isActive: updated.isActive !== false,
            updatedAt: new Date().toISOString(),
          });
        }
      } else {
        // Active VPS tenant with no local match → create it locally.
        const newCompany = {
          id: ct.id || `co-${Date.now()}`,
          slug: ct.slug,
          name: ct.name,
          isActive: ct.isActive !== false,
          dbConnectionString: '',
          connectionStatus: 'unknown' as const,
          connections: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        useTenantStore.setState((s) => ({ tenants: [...s.tenants, newCompany] }));
        void window.dbAPI?.upsertCompany?.(newCompany);
        slugToId.set(ct.slug, newCompany.id);
      }
    }

    // 2. Merge Endpoints (APIs)
    const currentTenants = useTenantStore.getState().tenants;
    const currentSlugToId = new Map(currentTenants.map((t) => [t.slug, t.id]));
    const endpointsByTenant = useEndpointStore.getState().endpointsByTenant;

    for (const ce of catalog.endpoints || []) {
      if (assignedSlugs.size > 0 && !assignedSlugs.has(ce.tenantSlug)) continue;
      const companyId = currentSlugToId.get(ce.tenantSlug);
      if (!companyId) continue;
      const list = endpointsByTenant[companyId] || [];
      const existing = list.find((e) => e.id === ce.id || (e.name === ce.name && e.pathTemplate === ce.pathTemplate));

      if (existing) {
        if (existing.name !== ce.name || existing.pathTemplate !== ce.pathTemplate || existing.method !== ce.method) {
          const patched = {
            ...existing,
            name: ce.name,
            pathTemplate: ce.pathTemplate,
            method: ce.method as any,
          };
          useEndpointStore.setState((s) => ({
            endpointsByTenant: {
              ...s.endpointsByTenant,
              [companyId]: (s.endpointsByTenant[companyId] || []).map((e) => (e.id === existing.id ? patched : e)),
            },
          }));
          void window.dbAPI?.upsertEndpoint?.({
            ...patched,
            companyId,
            updatedAt: new Date().toISOString(),
          });
        }
      } else {
        const newEp = {
          id: ce.id || `ep-${Date.now()}`,
          companyId,
          name: ce.name,
          method: ce.method as any,
          pathTemplate: ce.pathTemplate,
          sqlQuery: (ce as any).sqlQuery || 'SELECT 1',
          paramsSchema: ce.paramsSchema || { urlParams: [], queryParams: [], bodyParams: [] },
          cacheTtlSec: ce.cacheTtlSec || 0,
          authRequired: ce.authRequired !== false,
        };
        useEndpointStore.setState((s) => ({
          endpointsByTenant: {
            ...s.endpointsByTenant,
            [companyId]: [...(s.endpointsByTenant[companyId] || []), newEp],
          },
        }));
        void window.dbAPI?.upsertEndpoint?.({
          ...newEp,
          companyId,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    // 3. Merge Staff
    const localStaff = useStaffStore.getState().staff;
    const byUser = new Map(localStaff.map((s) => [s.username.toLowerCase(), s]));

    for (const rs of catalog.staff || []) {
      if (assignedSlugs.size > 0 && !assignedSlugs.has(rs.tenantSlug)) continue;
      const key = String(rs.username || '').toLowerCase();
      if (!key) continue;
      if (recentlyDeletedUsernames.has(key)) continue;
      const tenantId = currentSlugToId.get(rs.tenantSlug);
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
        useStaffStore.setState((s) => ({ staff: [...s.staff, member as any] }));
        void window.dbAPI?.upsertStaff?.({ ...member, updatedAt: new Date().toISOString() });
      }
    }
  } catch (err) {
    console.warn('[sync] pull catalog failed', err);
  }
}

async function runFullSync(creds: { gatewayUrl: string; deviceId: string; deviceSecret: string }) {
  await syncEndpointsAll(creds);
  const users = await syncStaffAll(creds);
  await pullCatalogFromVps(creds);
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
    if (!syncEnabled) {
      const msg = 'Sync açylmadyk — Sazlamalardan sync-i açyň';
      await window.dbAPI?.updateSyncMeta?.({ lastError: msg, lastAttemptAt: now });
      emit({ online: false, lastError: msg, lastAttemptAt: now });
      return { ok: false, message: msg };
    }

    await window.dbAPI?.updateSyncMeta?.({ lastAttemptAt: now });

    const creds = await getCreds();
    if (!creds) {
      const msg = 'Gateway URL / Admin Secret ýok — Settings-de dolduryň';
      await window.dbAPI?.updateSyncMeta?.({ lastError: msg, lastAttemptAt: now });
      emit({ online: false, lastError: msg, lastAttemptAt: now });
      return { ok: false, message: msg };
    }

    const perm = await checkDevicePermission();
    if (!perm.allowed) {
      const msg = `Enjamyň rugsaty ýok (${perm.reason || 'blocked'}) — sinhronizasiýa togtadyldy`;
      await window.dbAPI?.updateSyncMeta?.({ lastError: msg, lastAttemptAt: now });
      emit({ online: false, lastError: msg, lastAttemptAt: now });
      toastWarning('Enjam rugsady', 'Enjamyň girişi gadagan. Administrator bilen habarlaşyň.');
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

    // Process tenant-delete first so VPS deactivates before full-sync
    const deletes = queue.filter((q) => q.type === 'tenant-delete');
    const full = queue.find((q) => q.type === 'full-sync');
    const others = full
      ? [full]
      : queue.filter((q) => q.type !== 'tenant-delete' && q.type !== 'full-sync');
    const items = [...deletes, ...others];

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
          } else if (item.type === 'tenant-delete') {
            if (item.tenantSlug) {
              const r = await deleteTenantOnVps(creds.gatewayUrl, creds.deviceId, creds.deviceSecret, item.tenantSlug);
              if (!r.ok && r.status === 409) {
                // Dependencies remain — fall back to soft-deactivate
                await deactivateTenantOnVps(creds.gatewayUrl, creds.deviceId, creds.deviceSecret, item.tenantSlug);
                throw new Error(r.body?.message || 'has_dependencies');
              }
              if (!r.ok) throw new Error(r.body?.error || `tenant-delete ${r.status}`);
            }
          } else if (item.type === 'staff') {
            await syncStaffAll(creds);
          } else if (item.type === 'endpoints' || item.type === 'tenant') {
            if (item.tenantSlug) {
              const t = useTenantStore.getState().tenants.find((x) => x.slug === item.tenantSlug);
              // Passive tenants are local-only — never push them to the VPS.
              if (t && t.isActive !== false) {
                const endpoints =
                  useEndpointStore.getState().endpointsByTenant[t.id] || [];
                await syncToVps(creds.gatewayUrl, creds.deviceId, creds.deviceSecret, t, endpoints, true);
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
    const enabled = await isSyncEnabled();
    syncEnabled = enabled;
    if (!enabled) {
      await refreshMeta();
      return;
    }
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
