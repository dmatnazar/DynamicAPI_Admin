import { app, BrowserWindow, ipcMain, safeStorage, Menu } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { initAutoUpdater } from './updater';
import { createTray, destroyTray } from './tray';
import * as localDb from './localDb';
import * as mssqlHelper from './mssqlHelper';

// 1. AMD GPU baradaky error logy öçürmek üçin (Hardware Acceleration-y yapmak)
app.disableHardwareAcceleration();

const isDev = !app.isPackaged;
const VAULT_PATH = path.join(app.getPath('userData'), 'vault.json');

const AUTO_OPEN_DEVTOOLS = process.env.OPEN_DEVTOOLS === '1';

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;

Menu.setApplicationMenu(null);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 900,
    minHeight: 560,
    backgroundColor: '#0A0B0F',
    titleBarStyle: 'hiddenInset',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.setMenu(null);
  mainWindow.setMenuBarVisibility(false);

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    if (AUTO_OPEN_DEVTOOLS) mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  initAutoUpdater(mainWindow);
}

app.whenReady().then(() => {
  createWindow();

  createTray({
    getWindow: () => mainWindow,
    onShow: () => {
      if (!mainWindow) return createWindow();
      mainWindow.show();
      mainWindow.focus();
    },
    onRestart: () => {
      app.relaunch();
      isQuitting = true;
      app.quit();
    },
    onQuit: () => {
      isQuitting = true;
      app.quit();
    },
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else mainWindow?.show();
  });
});

app.on('before-quit', () => {
  isQuitting = true;
  destroyTray();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && isQuitting) app.quit();
});

// ---------------------------------------------------------------------------
// Window control IPC
// ---------------------------------------------------------------------------

ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:maximizeToggle', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.handle('window:hide', () => mainWindow?.hide());
ipcMain.handle('window:restartApp', () => {
  app.relaunch();
  isQuitting = true;
  app.quit();
});
ipcMain.handle('window:quitApp', () => {
  isQuitting = true;
  app.quit();
});

// ---------------------------------------------------------------------------
// Secure local vault
// ---------------------------------------------------------------------------

function readVault(): Record<string, string> {
  if (!fs.existsSync(VAULT_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(VAULT_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function writeVault(vault: Record<string, string>) {
  fs.writeFileSync(VAULT_PATH, JSON.stringify(vault, null, 2), 'utf8');
}

ipcMain.handle('vault:set', (_e, key: string, value: string) => {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS-level secure storage is not available on this machine');
  }
  const vault = readVault();
  vault[key] = safeStorage.encryptString(value).toString('base64');
  writeVault(vault);
  return true;
});

ipcMain.handle('vault:get', (_e, key: string) => {
  const vault = readVault();
  const enc = vault[key];
  if (!enc) return null;
  return safeStorage.decryptString(Buffer.from(enc, 'base64'));
});

ipcMain.handle('vault:delete', (_e, key: string) => {
  const vault = readVault();
  delete vault[key];
  writeVault(vault);
  return true;
});

// ---------------------------------------------------------------------------
// HMAC + staff password hashing
// ---------------------------------------------------------------------------

ipcMain.handle('crypto:signPayload', (_e, payload: unknown, secret: string) => {
  const body = JSON.stringify(payload);
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
});

ipcMain.handle('staff:hashPassword', (_e, plain: string) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(plain, salt, 64).toString('hex');
  return `${salt}:${hash}`;
});

ipcMain.handle('staff:verifyPassword', (_e, plain: string, stored: string) => {
  const [salt, hash] = (stored || '').split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(plain, salt, 64).toString('hex');
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(candidate, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
});

/** Reversible encrypt for admin UI "show password" (OS safeStorage) */
ipcMain.handle('staff:encryptSecret', (_e, plain: string) => {
  if (!safeStorage.isEncryptionAvailable()) {
    // fallback: base64 only (dev) — not secure but better than nothing
    return Buffer.from(plain, 'utf8').toString('base64');
  }
  return safeStorage.encryptString(plain).toString('base64');
});

ipcMain.handle('staff:decryptSecret', (_e, enc: string) => {
  if (!enc) return '';
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      return Buffer.from(enc, 'base64').toString('utf8');
    }
    return safeStorage.decryptString(Buffer.from(enc, 'base64'));
  } catch {
    return '';
  }
});

ipcMain.handle('app:getVersion', () => app.getVersion());

// ---------------------------------------------------------------------------
// Local database IPC — all app data lives in userData/local-admin.db.json
// Passwords are encrypted with safeStorage before write.
// ---------------------------------------------------------------------------


ipcMain.handle('mssql:testConnection', async (_e, input: mssqlHelper.MssqlConnectInput) => {
  return mssqlHelper.testMssqlConnection(input);
});

ipcMain.handle('mssql:listDatabases', async (_e, input: mssqlHelper.MssqlConnectInput) => {
  return mssqlHelper.listMssqlDatabases(input);
});

ipcMain.handle('db:exportSnapshot', () => localDb.exportSnapshot());

ipcMain.handle('db:upsertCompany', (_e, company: localDb.CompanyRecord) => {
  return localDb.upsertCompany(company);
});

ipcMain.handle('db:deleteCompany', (_e, id: string) => localDb.deleteCompany(id));

ipcMain.handle('db:upsertConnection', (_e, conn: localDb.ConnectionRecord & { password?: string }) => {
  const passwordEnc =
    conn.password !== undefined
      ? localDb.encryptSecret(conn.password)
      : conn.passwordEnc || '';
  const { password: _p, ...rest } = conn as localDb.ConnectionRecord & { password?: string };
  return localDb.upsertConnection({ ...rest, passwordEnc });
});

ipcMain.handle('db:deleteConnection', (_e, id: string) => localDb.deleteConnection(id));

ipcMain.handle('db:upsertStaff', (_e, member: localDb.StaffRecord) => localDb.upsertStaff(member));

ipcMain.handle('db:deleteStaff', (_e, id: string) => localDb.deleteStaff(id));

ipcMain.handle('db:upsertEndpoint', (_e, ep: localDb.EndpointRecord) => localDb.upsertEndpoint(ep));

ipcMain.handle('db:deleteEndpoint', (_e, id: string) => localDb.deleteEndpoint(id));

ipcMain.handle('db:getSettings', () => {
  const s = localDb.getSettings();
  return {
    gatewayUrl: s.gatewayUrl,
    adminSecret: localDb.decryptSecret(s.adminSecretEnc || ''),
  };
});

ipcMain.handle('db:updateSettings', (_e, patch: { gatewayUrl?: string; adminSecret?: string }) => {
  const next: Partial<localDb.SettingsRecord> = {};
  if (patch.gatewayUrl !== undefined) next.gatewayUrl = patch.gatewayUrl;
  if (patch.adminSecret !== undefined) next.adminSecretEnc = localDb.encryptSecret(patch.adminSecret);
  const s = localDb.updateSettings(next);
  return {
    gatewayUrl: s.gatewayUrl,
    adminSecret: localDb.decryptSecret(s.adminSecretEnc || ''),
  };
});

ipcMain.handle('db:listSyncQueue', () => localDb.listSyncQueue());
ipcMain.handle('db:enqueueSync', (_e, item: Parameters<typeof localDb.enqueueSync>[0]) =>
  localDb.enqueueSync(item)
);
ipcMain.handle('db:updateSyncQueueItem', (_e, id: string, patch: Partial<localDb.SyncQueueItem>) =>
  localDb.updateSyncQueueItem(id, patch)
);
ipcMain.handle('db:removeSyncQueueItem', (_e, id: string) => localDb.removeSyncQueueItem(id));
ipcMain.handle('db:getSyncMeta', () => localDb.getSyncMeta());
ipcMain.handle('db:updateSyncMeta', (_e, patch: Partial<localDb.SyncMeta>) =>
  localDb.updateSyncMeta(patch)
);

ipcMain.handle('mssql:executeQuery', async (_e, input: mssqlHelper.MssqlExecuteInput) => {
  return mssqlHelper.executeMssqlQuery(input);
});
