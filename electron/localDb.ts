/**
 * Local JSON "database" for the admin app.
 * Stored under Electron userData as `local-admin.db.json`.
 * Sensitive fields (passwords, full connection strings) are encrypted
 * via Electron safeStorage before being written to disk.
 */
import { app, safeStorage } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

export interface CompanyRecord {
  id: string;
  slug: string;
  name: string;
  /** Soft-active; false = passive (still listed in UI) */
  isActive?: boolean;
  legalName?: string;
  taxId?: string;
  registrationNumber?: string;
  industry?: string;
  country?: string;
  city?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectionRecord {
  id: string;
  companyId: string;
  label: string;
  dbType: string;
  host: string;
  port: number;
  database: string;
  username: string;
  /** Encrypted base64 via safeStorage when available */
  passwordEnc: string;
  encrypt: boolean;
  trustServerCertificate: boolean;
  isPrimary: boolean;
  connectionStatus: 'unknown' | 'testing' | 'success' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export interface StaffRecord {
  id: string;
  fullName: string;
  username: string;
  passwordHash: string;
  /** Encrypted plain password for admin UI reveal */
  passwordEnc?: string;
  role: 'admin' | 'editor' | 'viewer';
  tenantIds: string[];
  active: boolean;
  phone?: string;
  email?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EndpointRecord {
  id: string;
  companyId: string;
  connectionId?: string;
  name: string;
  method: string;
  pathTemplate: string;
  sqlQuery: string;
  paramsSchema: unknown;
  responseSchema?: unknown;
  cacheTtlSec: number;
  authRequired: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SettingsRecord {
  gatewayUrl: string;
  adminSecretEnc: string;
  [key: string]: unknown;
}

/** Persistent offline queue — survives app restart */
export interface SyncQueueItem {
  id: string;
  type: 'full-sync' | 'staff' | 'endpoints' | 'tenant';
  tenantSlug?: string;
  /** JSON-serializable payload if needed */
  payload?: unknown;
  attempts: number;
  lastError?: string;
  status: 'pending' | 'processing' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export interface SyncMeta {
  lastSuccessAt?: string;
  lastAttemptAt?: string;
  lastError?: string;
  lastResult?: string;
  autoSyncIntervalSec: number;
}

interface DbShape {
  version: number;
  companies: CompanyRecord[];
  connections: ConnectionRecord[];
  staff: StaffRecord[];
  endpoints: EndpointRecord[];
  settings: SettingsRecord;
  syncQueue: SyncQueueItem[];
  syncMeta: SyncMeta;
}

const DB_VERSION = 2;

function dbPath() {
  return path.join(app.getPath('userData'), 'local-admin.db.json');
}

function emptyDb(): DbShape {
  return {
    version: DB_VERSION,
    companies: [],
    connections: [],
    staff: [],
    endpoints: [],
    settings: { gatewayUrl: '', adminSecretEnc: '' },
    syncQueue: [],
    syncMeta: { autoSyncIntervalSec: 30 },
  };
}

function readRaw(): DbShape {
  const p = dbPath();
  if (!fs.existsSync(p)) return emptyDb();
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf8')) as DbShape;
    if (!Array.isArray((data as any).syncQueue)) (data as any).syncQueue = [];
    if (!(data as any).syncMeta) (data as any).syncMeta = { autoSyncIntervalSec: 30 };
    (data as any).version = DB_VERSION;
    if (!data.version) return emptyDb();
    return {
      ...emptyDb(),
      ...data,
      companies: data.companies ?? [],
      connections: data.connections ?? [],
      staff: data.staff ?? [],
      endpoints: data.endpoints ?? [],
      settings: { ...emptyDb().settings, ...(data.settings ?? {}) },
    };
  } catch {
    return emptyDb();
  }
}

function writeRaw(db: DbShape) {
  const p = dbPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(db, null, 2), 'utf8');
}

export function encryptSecret(plain: string): string {
  if (!plain) return '';
  if (!safeStorage.isEncryptionAvailable()) {
    // Fallback: still base64 so we never write pure plaintext accidentally
    // (not as strong as DPAPI/Keychain, but better than raw).
    return Buffer.from(plain, 'utf8').toString('base64');
  }
  return safeStorage.encryptString(plain).toString('base64');
}

export function decryptSecret(enc: string): string {
  if (!enc) return '';
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(Buffer.from(enc, 'base64'));
    }
    return Buffer.from(enc, 'base64').toString('utf8');
  } catch {
    return '';
  }
}

export function buildConnectionString(c: {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  encrypt?: boolean;
  trustServerCertificate?: boolean;
}): string {
  const encrypt = c.encrypt !== false;
  const trust = c.trustServerCertificate !== false;
  return [
    `Server=${c.host},${c.port || 1433}`,
    `Database=${c.database}`,
    `User Id=${c.username}`,
    `Password=${c.password}`,
    `Encrypt=${encrypt}`,
    `TrustServerCertificate=${trust}`,
  ].join(';') + ';';
}

// ---------------------------------------------------------------------------
// Companies
// ---------------------------------------------------------------------------

export function listCompanies(): CompanyRecord[] {
  return readRaw().companies;
}

export function getCompany(id: string): CompanyRecord | null {
  return readRaw().companies.find((c) => c.id === id) ?? null;
}

export function upsertCompany(company: CompanyRecord): CompanyRecord {
  const db = readRaw();
  const idx = db.companies.findIndex((c) => c.id === company.id);
  const now = new Date().toISOString();
  const row: CompanyRecord = {
    ...company,
    updatedAt: now,
    createdAt: company.createdAt || now,
  };
  if (idx >= 0) db.companies[idx] = row;
  else db.companies.push(row);
  writeRaw(db);
  return row;
}

export function deleteCompany(id: string): boolean {
  const db = readRaw();
  const before = db.companies.length;
  db.companies = db.companies.filter((c) => c.id !== id);
  db.connections = db.connections.filter((c) => c.companyId !== id);
  db.endpoints = db.endpoints.filter((e) => e.companyId !== id);
  db.staff = db.staff.map((s) => ({
    ...s,
    tenantIds: s.tenantIds.filter((t) => t !== id),
  }));
  writeRaw(db);
  return db.companies.length < before;
}

// ---------------------------------------------------------------------------
// Connections
// ---------------------------------------------------------------------------

export function listConnections(companyId?: string): ConnectionRecord[] {
  const all = readRaw().connections;
  return companyId ? all.filter((c) => c.companyId === companyId) : all;
}

export function upsertConnection(conn: ConnectionRecord): ConnectionRecord {
  const db = readRaw();
  const now = new Date().toISOString();
  const row: ConnectionRecord = {
    ...conn,
    updatedAt: now,
    createdAt: conn.createdAt || now,
  };
  // Ensure only one primary per company
  if (row.isPrimary) {
    db.connections = db.connections.map((c) =>
      c.companyId === row.companyId && c.id !== row.id ? { ...c, isPrimary: false } : c
    );
  }
  const idx = db.connections.findIndex((c) => c.id === row.id);
  if (idx >= 0) db.connections[idx] = row;
  else db.connections.push(row);
  writeRaw(db);
  return row;
}

export function deleteConnection(id: string): boolean {
  const db = readRaw();
  const removed = db.connections.find((c) => c.id === id);
  db.connections = db.connections.filter((c) => c.id !== id);
  if (removed?.isPrimary) {
    const siblings = db.connections.filter((c) => c.companyId === removed.companyId);
    if (siblings[0]) {
      siblings[0].isPrimary = true;
    }
  }
  writeRaw(db);
  return !!removed;
}

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

export function listStaff(): StaffRecord[] {
  return readRaw().staff;
}

export function upsertStaff(member: StaffRecord): StaffRecord {
  const db = readRaw();
  const now = new Date().toISOString();
  const row: StaffRecord = {
    ...member,
    updatedAt: now,
    createdAt: member.createdAt || now,
  };
  const idx = db.staff.findIndex((s) => s.id === row.id);
  if (idx >= 0) db.staff[idx] = row;
  else db.staff.push(row);
  writeRaw(db);
  return row;
}

export function deleteStaff(id: string): boolean {
  const db = readRaw();
  const before = db.staff.length;
  db.staff = db.staff.filter((s) => s.id !== id);
  writeRaw(db);
  return db.staff.length < before;
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

export function listEndpoints(companyId?: string): EndpointRecord[] {
  const all = readRaw().endpoints;
  return companyId ? all.filter((e) => e.companyId === companyId) : all;
}

export function upsertEndpoint(ep: EndpointRecord): EndpointRecord {
  const db = readRaw();
  const now = new Date().toISOString();
  const row: EndpointRecord = {
    ...ep,
    updatedAt: now,
    createdAt: ep.createdAt || now,
  };
  const idx = db.endpoints.findIndex((e) => e.id === row.id);
  if (idx >= 0) db.endpoints[idx] = row;
  else db.endpoints.push(row);
  writeRaw(db);
  return row;
}

export function deleteEndpoint(id: string): boolean {
  const db = readRaw();
  const before = db.endpoints.length;
  db.endpoints = db.endpoints.filter((e) => e.id !== id);
  writeRaw(db);
  return db.endpoints.length < before;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export function getSettings(): SettingsRecord {
  return readRaw().settings;
}

export function updateSettings(patch: Partial<SettingsRecord>): SettingsRecord {
  const db = readRaw();
  db.settings = { ...db.settings, ...patch };
  writeRaw(db);
  return db.settings;
}

/** Full snapshot for hydrating the renderer stores (passwords decrypted). */
export function exportSnapshot() {
  const db = readRaw();
  return {
    companies: db.companies,
    connections: db.connections.map((c) => ({
      ...c,
      password: decryptSecret(c.passwordEnc),
      passwordEnc: undefined,
    })),
    staff: db.staff,
    endpoints: db.endpoints,
    settings: {
      gatewayUrl: db.settings.gatewayUrl,
      adminSecret: decryptSecret(db.settings.adminSecretEnc || ''),
    },
  };
}


// ---------------------------------------------------------------------------
// Sync queue (persistent)
// ---------------------------------------------------------------------------

export function listSyncQueue(): SyncQueueItem[] {
  return readRaw().syncQueue || [];
}

export function enqueueSync(
  item: Omit<SyncQueueItem, 'id' | 'attempts' | 'status' | 'createdAt' | 'updatedAt'> & {
    id?: string;
  }
): SyncQueueItem {
  const db = readRaw();
  const now = new Date().toISOString();
  // Dedupe: same type+tenantSlug pending → refresh updatedAt only
  const existing = (db.syncQueue || []).find(
    (q) =>
      q.status === 'pending' &&
      q.type === item.type &&
      (q.tenantSlug || '') === (item.tenantSlug || '')
  );
  if (existing) {
    existing.updatedAt = now;
    existing.payload = item.payload ?? existing.payload;
    writeRaw(db);
    return existing;
  }
  const row: SyncQueueItem = {
    id: item.id || `sq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: item.type,
    tenantSlug: item.tenantSlug,
    payload: item.payload,
    attempts: 0,
    lastError: undefined,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };
  db.syncQueue = [...(db.syncQueue || []), row];
  writeRaw(db);
  return row;
}

export function updateSyncQueueItem(
  id: string,
  patch: Partial<SyncQueueItem>
): SyncQueueItem | null {
  const db = readRaw();
  const idx = (db.syncQueue || []).findIndex((q) => q.id === id);
  if (idx < 0) return null;
  db.syncQueue[idx] = {
    ...db.syncQueue[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  writeRaw(db);
  return db.syncQueue[idx];
}

export function removeSyncQueueItem(id: string): boolean {
  const db = readRaw();
  const before = (db.syncQueue || []).length;
  db.syncQueue = (db.syncQueue || []).filter((q) => q.id !== id);
  writeRaw(db);
  return db.syncQueue.length < before;
}

export function getSyncMeta(): SyncMeta {
  return readRaw().syncMeta || { autoSyncIntervalSec: 30 };
}

export function updateSyncMeta(patch: Partial<SyncMeta>): SyncMeta {
  const db = readRaw();
  db.syncMeta = { ...(db.syncMeta || { autoSyncIntervalSec: 30 }), ...patch };
  writeRaw(db);
  return db.syncMeta;
}
