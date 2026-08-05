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
});

contextBridge.exposeInMainWorld('updaterAPI', {
  check: () => ipcRenderer.invoke('updater:check'),
  download: () => ipcRenderer.invoke('updater:download'),
  install: () => ipcRenderer.invoke('updater:install'),
  onAvailable: (cb: (info: { version: string }) => void) =>
    ipcRenderer.on('updater:available', (_e, data) => cb(data)),
  onProgress: (cb: (p: { percent: number }) => void) =>
    ipcRenderer.on('updater:progress', (_e, data) => cb(data)),
  onDownloaded: (cb: (info: { version: string }) => void) =>
    ipcRenderer.on('updater:downloaded', (_e, data) => cb(data)),
  onError: (cb: (e: { message: string }) => void) =>
    ipcRenderer.on('updater:error', (_e, data) => cb(data)),
});

contextBridge.exposeInMainWorld('appAPI', {
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
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
});
