import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('vaultAPI', {
  set: (key: string, value: string) => ipcRenderer.invoke('vault:set', key, value),
  get: (key: string) => ipcRenderer.invoke('vault:get', key),
  delete: (key: string) => ipcRenderer.invoke('vault:delete', key),
});

contextBridge.exposeInMainWorld('cryptoAPI', {
  signPayload: (payload: unknown, secret: string) =>
    ipcRenderer.invoke('crypto:signPayload', payload, secret),
});

contextBridge.exposeInMainWorld('staffAPI', {
  hashPassword: (plain: string) => ipcRenderer.invoke('staff:hashPassword', plain),
  verifyPassword: (plain: string, stored: string) =>
    ipcRenderer.invoke('staff:verifyPassword', plain, stored),
  encryptSecret: (plain: string) => ipcRenderer.invoke('staff:encryptSecret', plain),
  decryptSecret: (enc: string) => ipcRenderer.invoke('staff:decryptSecret', enc),
  verifyAdminPassword: (password: string) =>
    ipcRenderer.invoke('staff:verifyAdminPassword', password),
});

contextBridge.exposeInMainWorld('updaterAPI', {
  check: () => ipcRenderer.invoke('updater:check'),
  download: () => ipcRenderer.invoke('updater:download'),
  install: () => ipcRenderer.invoke('updater:install'),
  getConfig: () => ipcRenderer.invoke('updater:getConfig'),
  saveConfig: (cfg: unknown) => ipcRenderer.invoke('updater:saveConfig', cfg),
  setFeedUrl: (url: string) => ipcRenderer.invoke('updater:setFeedUrl', url),
  getFeedUrl: () => ipcRenderer.invoke('updater:getFeedUrl'),
  onAvailable: (cb: (info: { version: string; releaseNotes?: string; releaseDate?: string }) => void) =>
    ipcRenderer.on('updater:available', (_e, data) => cb(data)),
  onProgress: (cb: (p: { percent: number; bytesPerSecond?: number; transferred?: number; total?: number }) => void) =>
    ipcRenderer.on('updater:progress', (_e, data) => cb(data)),
  onDownloaded: (cb: (info: { version: string; releaseNotes?: string }) => void) =>
    ipcRenderer.on('updater:downloaded', (_e, data) => cb(data)),
  onError: (cb: (e: { message: string }) => void) =>
    ipcRenderer.on('updater:error', (_e, data) => cb(data)),
});

contextBridge.exposeInMainWorld('appAPI', {
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  getAutoLaunch: () => ipcRenderer.invoke('app:getAutoLaunch'),
  setAutoLaunch: (enabled: boolean) => ipcRenderer.invoke('app:setAutoLaunch', enabled),
});

contextBridge.exposeInMainWorld('windowAPI', {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximizeToggle: () => ipcRenderer.invoke('window:maximizeToggle'),
  hide: () => ipcRenderer.invoke('window:hide'),
  restartApp: () => ipcRenderer.invoke('window:restartApp'),
  quitApp: () => ipcRenderer.invoke('window:quitApp'),
});

/** Local database API — companies, connections, staff, endpoints, settings */
contextBridge.exposeInMainWorld('mssqlAPI', {
  testConnection: (input: {
    host: string;
    port?: number;
    database?: string;
    username: string;
    password: string;
    encrypt?: boolean;
    trustServerCertificate?: boolean;
  }) => ipcRenderer.invoke('mssql:testConnection', input),
  listDatabases: (input: {
    host: string;
    port?: number;
    database?: string;
    username: string;
    password: string;
    encrypt?: boolean;
    trustServerCertificate?: boolean;
  }) => ipcRenderer.invoke('mssql:listDatabases', input),
  executeQuery: (input: {
    host: string;
    port?: number;
    database?: string;
    username: string;
    password: string;
    encrypt?: boolean;
    trustServerCertificate?: boolean;
    sqlQuery: string;
    params?: Record<string, unknown>;
  }) => ipcRenderer.invoke('mssql:executeQuery', input),
});

contextBridge.exposeInMainWorld('dbAPI', {
  exportSnapshot: () => ipcRenderer.invoke('db:exportSnapshot'),
  upsertCompany: (company: unknown) => ipcRenderer.invoke('db:upsertCompany', company),
  deleteCompany: (id: string) => ipcRenderer.invoke('db:deleteCompany', id),
  upsertConnection: (conn: unknown) => ipcRenderer.invoke('db:upsertConnection', conn),
  deleteConnection: (id: string) => ipcRenderer.invoke('db:deleteConnection', id),
  upsertStaff: (member: unknown) => ipcRenderer.invoke('db:upsertStaff', member),
  deleteStaff: (id: string) => ipcRenderer.invoke('db:deleteStaff', id),
  upsertEndpoint: (ep: unknown) => ipcRenderer.invoke('db:upsertEndpoint', ep),
  deleteEndpoint: (id: string) => ipcRenderer.invoke('db:deleteEndpoint', id),
  getSettings: () => ipcRenderer.invoke('db:getSettings'),
  updateSettings: (patch: { gatewayUrl?: string; adminSecret?: string }) =>
    ipcRenderer.invoke('db:updateSettings', patch),
  listSyncQueue: () => ipcRenderer.invoke('db:listSyncQueue'),
  enqueueSync: (item: unknown) => ipcRenderer.invoke('db:enqueueSync', item),
  updateSyncQueueItem: (id: string, patch: unknown) =>
    ipcRenderer.invoke('db:updateSyncQueueItem', id, patch),
  removeSyncQueueItem: (id: string) => ipcRenderer.invoke('db:removeSyncQueueItem', id),
  getSyncMeta: () => ipcRenderer.invoke('db:getSyncMeta'),
  updateSyncMeta: (patch: unknown) => ipcRenderer.invoke('db:updateSyncMeta', patch),
});

contextBridge.exposeInMainWorld('appLockAPI', {
  hasPassword: () => ipcRenderer.invoke('appLock:hasPassword'),
  setPassword: (plain: string) => ipcRenderer.invoke('appLock:setPassword', plain),
  clearPassword: () => ipcRenderer.invoke('appLock:clearPassword'),
  verify: (plain: string) => ipcRenderer.invoke('appLock:verify', plain),
});

contextBridge.exposeInMainWorld('trayAPI', {
  setStatus: (status: 'ok' | 'partial' | 'offline') =>
    ipcRenderer.invoke('tray:setStatus', status),
});

contextBridge.exposeInMainWorld('agentAPI', {
  getStatuses: () => ipcRenderer.invoke('agent:getStatuses'),
  restart: () => ipcRenderer.invoke('agent:restart'),
  onStatusChanged: (cb: (statuses: any) => void) => {
    const handler = (_e: any, data: any) => cb(data);
    ipcRenderer.on('agent:statusChanged', handler);
    return () => ipcRenderer.removeListener('agent:statusChanged', handler);
  },
});

contextBridge.exposeInMainWorld('deviceAPI', {
  getProfile: () => ipcRenderer.invoke('device:getProfile'),
  register: () => ipcRenderer.invoke('device:register'),
  checkStatus: () => ipcRenderer.invoke('device:checkStatus'),
  checkPermission: () => ipcRenderer.invoke('device:checkPermission'),
  requestPermission: () => ipcRenderer.invoke('device:requestPermission'),
  saveProfile: (patch: unknown) => ipcRenderer.invoke('device:saveProfile', patch),
  onStatusChanged: (cb: (profile: unknown) => void) => {
    const handler = (_e: any, data: unknown) => cb(data);
    ipcRenderer.on('device:statusChanged', handler);
    return () => ipcRenderer.removeListener('device:statusChanged', handler);
  },
  onEvent: (cb: (event: { type: string; deviceId: string; status?: string; companySlugs?: string[]; companyNames?: string[]; timestamp?: string }) => void) => {
    const handler = (_e: any, data: any) => cb(data);
    ipcRenderer.on('device:event', handler);
    return () => ipcRenderer.removeListener('device:event', handler);
  },
});

contextBridge.exposeInMainWorld('authAPI', {
  loginStaff: (credentials: { username: string; password: string; companyId?: string }) =>
    ipcRenderer.invoke('auth:loginStaff', credentials),
});


