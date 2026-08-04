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

// Window chrome controls — needed because the native menu bar / traffic
// lights are hidden; the in-app title bar (src/components/TitleBar.tsx)
// calls these instead.
contextBridge.exposeInMainWorld('windowAPI', {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximizeToggle: () => ipcRenderer.invoke('window:maximizeToggle'),
  hide: () => ipcRenderer.invoke('window:hide'),
  restartApp: () => ipcRenderer.invoke('window:restartApp'),
  quitApp: () => ipcRenderer.invoke('window:quitApp'),
});
