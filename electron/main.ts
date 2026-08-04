import { app, BrowserWindow, ipcMain, safeStorage, Menu } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { initAutoUpdater } from './updater';
import { createTray, destroyTray } from './tray';

const isDev = !app.isPackaged;
const VAULT_PATH = path.join(app.getPath('userData'), 'vault.json');

// Set this env var (e.g. `OPEN_DEVTOOLS=1 npm run dev`) if you need DevTools
// open automatically during development. Normal dev/prod runs never open it.
const AUTO_OPEN_DEVTOOLS = process.env.OPEN_DEVTOOLS === '1';

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;

// ---------------------------------------------------------------------------
// Remove the default "File / Edit / View / Window / Help" menu bar entirely.
// Must be called before any window is created.
// ---------------------------------------------------------------------------
Menu.setApplicationMenu(null);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 900,
    minHeight: 560,
    backgroundColor: '#0A0B0F',
    titleBarStyle: 'hiddenInset',
    autoHideMenuBar: true, // extra safety net on Windows/Linux
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Belt-and-suspenders: some platforms still render a 1px menu unless this
  // is also called on the window instance itself.
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

  // Close (X) button minimizes to tray instead of quitting, so the app can
  // keep syncing in the background. Real quit happens via tray "Exit" or
  // app.quit() (e.g. from an update install).
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
  // Tray keeps the app alive on Windows/Linux; on macOS this is default
  // behaviour anyway. Actual quit is only triggered via tray/menu "Exit".
  if (process.platform !== 'darwin' && isQuitting) app.quit();
});

// ---------------------------------------------------------------------------
// Window control IPC (used by the custom in-app title bar, since the native
// menu bar / traffic lights are hidden)
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
// Secure local vault (tenant connection strings, admin secret) using
// Electron's OS-level safeStorage (DPAPI on Windows, Keychain on macOS,
// libsecret on Linux) — never persisted in plaintext on disk.
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
// HMAC signing for the admin sync-schema request — kept in the main
// process so the signing secret never touches the (less trusted) renderer.
// ---------------------------------------------------------------------------

ipcMain.handle('crypto:signPayload', (_e, payload: unknown, secret: string) => {
  const body = JSON.stringify(payload);
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
});

// ---------------------------------------------------------------------------
// Staff password hashing (scrypt + per-password salt), done in the main
// process so plaintext passwords never need a renderer-side crypto
// implementation and never get logged to the (less trusted) renderer.
// Stored format: "<saltHex>:<hashHex>"
// ---------------------------------------------------------------------------

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

ipcMain.handle('app:getVersion', () => app.getVersion());
