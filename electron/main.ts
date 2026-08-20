import { app, BrowserWindow, ipcMain, safeStorage, Menu, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { initAutoUpdater } from './updater';
import { createTray, destroyTray, setTrayStatus, resolveIconPath, type TrayConnectionStatus } from './tray';
import * as localDb from './localDb';
import * as mssqlHelper from './mssqlHelper';
import { localAgentManager, deviceEventsClient, initLocalAgentIpc } from './localAgent';
import {
  loadOrGenerateDeviceProfile,
  saveDeviceProfile,
  registerDeviceWithGateway,
  checkDeviceStatusWithGateway,
  checkDevicePermission,
  nodeFetch,
} from './deviceFingerprint';

app.disableHardwareAcceleration();

// ---------------------------------------------------------------------------
// Single instance — eýýäm işleýän bolsa warning + focus
// ---------------------------------------------------------------------------
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.whenReady().then(() => {
    dialog.showErrorBox(
      'Eýýäm işleýär',
      'BI Platform Client eýýäm açyk. Täze penjirä gerek däl — bar bolan penjäni ulanyň.'
    );
    app.quit();
  });
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
    dialog.showMessageBox({
      type: 'warning',
      title: 'Eýýäm işleýär',
      message: 'BI Platform Client eýýäm işleýär',
      detail:
        'Programma eýýäm açyk. Ikinji nusga başladyrylmaýar — bar bolan penjirä getirildi.',
      buttons: ['OK'],
      noLink: true,
    });
  });
}

const isDev = !app.isPackaged;
const VAULT_PATH = path.join(app.getPath('userData'), 'vault.json');
const AUTO_OPEN_DEVTOOLS = process.env.OPEN_DEVTOOLS === '1';

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;

Menu.setApplicationMenu(null);

function getAppIconPath() {
  for (const name of ['icon.ico', 'app.ico', 'fallback.ico']) {
    const p = resolveIconPath(name);
    if (fs.existsSync(p)) return p;
  }
  return resolveIconPath('fallback.ico');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 900,
    minHeight: 560,
    backgroundColor: '#0A0B0F',
    icon: getAppIconPath(),
    titleBarStyle: 'hidden',
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

if (gotLock) {
  app.whenReady().then(() => {
    initLocalAgentIpc();
    localAgentManager.start();
    deviceEventsClient.start();
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
}

app.on('before-quit', () => {
  isQuitting = true;
  localAgentManager.stop();
  deviceEventsClient.stop();
  destroyTray();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && isQuitting) app.quit();
});

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

ipcMain.handle('tray:setStatus', (_e, status: TrayConnectionStatus) => {
  if (status === 'ok' || status === 'partial' || status === 'offline') {
    setTrayStatus(status);
  }
  return true;
});

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

ipcMain.handle('staff:encryptSecret', (_e, plain: string) => {
  if (!safeStorage.isEncryptionAvailable()) {
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

ipcMain.handle('staff:verifyAdminPassword', (_e, password: string) => {
  const settings = localDb.getSettings();
  const adminSecret = localDb.decryptSecret(settings.adminSecretEnc || '');
  if (!adminSecret) return { ok: false };
  return { ok: password === adminSecret };
});

ipcMain.handle('app:getVersion', () => app.getVersion());

ipcMain.handle('app:getAutoLaunch', () => app.getLoginItemSettings().openAtLogin);

ipcMain.handle('app:setAutoLaunch', (_e, enabled: boolean) => {
  app.setLoginItemSettings({ openAtLogin: enabled, openAsHidden: true });
  return { ok: true, openAtLogin: app.getLoginItemSettings().openAtLogin };
});

// App unlock password (scrypt hash in vault key appLockPasswordHash)
ipcMain.handle('appLock:hasPassword', () => {
  const vault = readVault();
  return !!vault['appLockPasswordHash'];
});

ipcMain.handle('appLock:setPassword', (_e, plain: string) => {
  if (!plain || plain.length < 4) {
    throw new Error('Parol azyndan 4 simwol bolmaly');
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(plain, salt, 64).toString('hex');
  const stored = `${salt}:${hash}`;
  const vault = readVault();
  if (safeStorage.isEncryptionAvailable()) {
    vault['appLockPasswordHash'] = safeStorage.encryptString(stored).toString('base64');
  } else {
    vault['appLockPasswordHash'] = Buffer.from(stored, 'utf8').toString('base64');
  }
  writeVault(vault);
  return true;
});

ipcMain.handle('appLock:clearPassword', () => {
  const vault = readVault();
  delete vault['appLockPasswordHash'];
  writeVault(vault);
  return true;
});

ipcMain.handle('appLock:verify', (_e, plain: string) => {
  const vault = readVault();
  const enc = vault['appLockPasswordHash'];
  if (!enc) {
    // Default password is admin1001 when no custom password is set
    return plain === 'admin1001';
  }
  let stored = '';
  try {
    if (safeStorage.isEncryptionAvailable()) {
      stored = safeStorage.decryptString(Buffer.from(enc, 'base64'));
    } else {
      stored = Buffer.from(enc, 'base64').toString('utf8');
    }
  } catch {
    return false;
  }
  const [salt, hash] = (stored || '').split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(plain || '', salt, 64).toString('hex');
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(candidate, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
});

ipcMain.handle('mssql:testConnection', async (_e, input: mssqlHelper.MssqlConnectInput) => {
  return mssqlHelper.testMssqlConnection(input);
});

ipcMain.handle('mssql:listDatabases', async (_e, input: mssqlHelper.MssqlConnectInput) => {
  return mssqlHelper.listMssqlDatabases(input);
});

ipcMain.handle('db:exportSnapshot', () => localDb.exportSnapshot());
ipcMain.handle('db:upsertCompany', (_e, company: localDb.CompanyRecord) => localDb.upsertCompany(company));
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
ipcMain.handle('db:enqueueSync', (_e, item: Parameters<typeof localDb.enqueueSync>[0]) => localDb.enqueueSync(item));
ipcMain.handle('db:updateSyncQueueItem', (_e, id: string, patch: Partial<localDb.SyncQueueItem>) =>
  localDb.updateSyncQueueItem(id, patch)
);
ipcMain.handle('db:removeSyncQueueItem', (_e, id: string) => localDb.removeSyncQueueItem(id));
ipcMain.handle('db:getSyncMeta', () => localDb.getSyncMeta());
ipcMain.handle('db:updateSyncMeta', (_e, patch: Partial<localDb.SyncMeta>) => localDb.updateSyncMeta(patch));
ipcMain.handle('mssql:executeQuery', async (_e, input: mssqlHelper.MssqlExecuteInput) => {
  return mssqlHelper.executeMssqlQuery(input);
});

// ── Device & Hardware Handlers ──────────────────────────────────────────

ipcMain.handle('device:getProfile', () => {
  return loadOrGenerateDeviceProfile();
});

ipcMain.handle('device:saveProfile', (_e, patch: any) => {
  return saveDeviceProfile(patch);
});

ipcMain.handle('device:register', async () => {
  const settings = localDb.getSettings();
  return registerDeviceWithGateway(settings.gatewayUrl);
});

ipcMain.handle('device:requestPermission', async () => {
  const settings = localDb.getSettings();
  const result = await checkDeviceStatusWithGateway(settings.gatewayUrl);
  if (result.ok && result.profile?.status === 'approved') {
    return { ok: true };
  }
  return { ok: false, error: result.error || 'Permission not granted' };
});

ipcMain.handle('device:checkStatus', async () => {
  const settings = localDb.getSettings();
  return checkDeviceStatusWithGateway(settings.gatewayUrl);
});

ipcMain.handle('device:checkPermission', async () => {
  const settings = localDb.getSettings();
  return checkDevicePermission(settings.gatewayUrl);
});

// ── Staff Login / Authentication Handlers ───────────────────────────────

ipcMain.handle('auth:loginStaff', async (_e, credentials: { username: string; password: string; companyId?: string }) => {
  const { username, password } = credentials;
  if (!username || !password) {
    return { ok: false, error: 'Ulanyjy ady we parol gerek' };
  }

  const settings = localDb.getSettings();
  const gatewayUrl = settings.gatewayUrl;
  // Local master password only (app unlock / bootstrap admin) — NOT VPS ADMIN_SYNC_SECRET
  const adminSecret = localDb.decryptSecret(settings.adminSecretEnc || '');

  // ── STEP 1: Try VPS Gateway public auth (no ADMIN_SYNC_SECRET needed) ─
  // Electron → VPS admin APIs use device_sync_secret; public /api/auth/verify needs none.
  if (gatewayUrl) {
    try {
      const url = `${gatewayUrl.replace(/\/$/, '')}/api/auth/verify`;
      console.log('[auth] trying VPS verify', { url, username: username.trim() });
      const res = await nodeFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      console.log('[auth] VPS verify response', { status: res.status, ok: res.ok });

      if (res.ok) {
        const data = (await res.json()) as any;
        console.log('[auth] VPS verify data', data);
        if (data.ok && data.user) {
          const u = data.user;
          const isAdmin = u.role === 'admin';
          const primaryTenantId = u.tenantId || u.tenantSlug || (isAdmin ? 'master' : undefined);
          const company = (localDb.exportSnapshot().companies || []).find((c: any) => c.id === primaryTenantId);
          console.log('[auth] VPS login success', u.username, 'role:', u.role, 'tenantId:', primaryTenantId);
          return {
            ok: true,
            user: {
              id: u.id,
              username: u.username,
              fullName: u.fullName,
              role: u.role || 'viewer',
              companyId: primaryTenantId,
              companySlug: company?.slug || u.tenantSlug || (isAdmin ? '' : undefined),
              companyName: company?.name || u.tenantName || (isAdmin ? 'Hemme Firmalar' : undefined),
              isSuperAdmin: isAdmin,
            },
          };
        }
      }

      if (res.status === 401) {
        console.log('[auth] VPS verify: invalid password');
        return { ok: false, error: 'Ulanyjy ady ýa-da parol nädogry' };
      }
      if (res.status === 404) {
        console.log('[auth] VPS verify: user not found');
        return { ok: false, error: 'Ulanyjy tapylmady' };
      }
      if (res.status === 403) {
        const data = (await res.json()) as any;
        console.log('[auth] VPS verify: forbidden', data);
        return { ok: false, error: data.message || 'Bu hasap üçin giriş gadagan' };
      }
      console.log('[auth] VPS verify: unexpected response', res.status);
    } catch (err: any) {
      console.log('[auth] VPS login failed, falling back to local:', err?.message);
      // Fall through to local DB fallback
    }
  }

  // ── STEP 2: Fallback to local DB (offline mode) ──────────────────────
  const snapshot = localDb.exportSnapshot();
  const staffList = snapshot.staff || [];
  const companies = snapshot.companies || [];

  const member = staffList.find((s) => s.username.toLowerCase() === username.trim().toLowerCase());

  if (member) {
    if (!member.active) {
      return { ok: false, error: 'Bu ulanyjy işjeň däl (deactivated). Administrator bilen habarlaşyň.' };
    }

    let passwordMatches = false;
    const isPlaceholder =
      !member.passwordHash ||
      member.passwordHash.startsWith('synced-from-bi') ||
      member.passwordHash.startsWith('pending-reset') ||
      member.passwordHash.endsWith(':0000');

    if (!isPlaceholder) {
      if (member.passwordHash && member.passwordHash.includes(':')) {
        const [salt, hash] = member.passwordHash.split(':');
        if (salt && hash) {
          try {
            const candidate = crypto.scryptSync(password, salt, 64).toString('hex');
            const a = Buffer.from(hash, 'hex');
            const b = Buffer.from(candidate, 'hex');
            passwordMatches = a.length === b.length && crypto.timingSafeEqual(a, b);
          } catch {
            passwordMatches = false;
          }
        }
      } else if (member.passwordHash) {
        passwordMatches = member.passwordHash === password;
      }
    }

    if (!passwordMatches) {
      console.log('[auth] local password mismatch for', member.username, 'hash prefix:', member.passwordHash?.slice(0, 20));
      return { ok: false, error: 'Parol nädogry' };
    }

    const isAdmin = member.role === 'admin';
    const primaryTenantId = (member.tenantIds || [])[0];
    const company = companies.find((c) => c.id === primaryTenantId);
    console.log('[auth] local login success', member.username, 'role:', member.role, 'tenantId:', primaryTenantId, 'company:', company?.slug);
    return {
      ok: true,
      user: {
        id: member.id,
        username: member.username,
        fullName: member.fullName,
        role: member.role || 'viewer',
        companyId: primaryTenantId || (isAdmin ? 'master' : undefined),
        companySlug: company?.slug || (isAdmin ? '' : undefined),
        companyName: company?.name || (isAdmin ? 'Hemme Firmalar' : undefined),
        isSuperAdmin: isAdmin,
      },
    };
  }

  // ── STEP 3: Master admin fallback ────────────────────────────────────
  if (username.trim().toLowerCase() === 'admin') {
    if (adminSecret && password === adminSecret) {
      return {
        ok: true,
        user: {
          id: 'master-admin',
          username: 'admin',
          fullName: 'Ulgam Dolandyryjysy (Admin)',
          role: 'admin',
          companyId: 'master',
          companySlug: '',
          companyName: 'Hemme Firmalar',
          isSuperAdmin: true,
        },
      };
    }

    // If staff list is empty, allow initial setup password "admin"
    if (staffList.length === 0 && (password === 'admin' || password === '123456')) {
      return {
        ok: true,
        user: {
          id: 'initial-admin',
          username: 'admin',
          fullName: 'Ulgam Dolandyryjysy',
          role: 'admin',
          isSuperAdmin: true,
        },
      };
    }
  }

  return { ok: false, error: 'Ulanyjy tapylmady ýa-da parol nädogry' };
});

