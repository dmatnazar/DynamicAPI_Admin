import { app, BrowserWindow, ipcMain, safeStorage } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { initAutoUpdater } from './updater';

const isDev = !app.isPackaged;
const VAULT_PATH = path.join(app.getPath('userData'), 'vault.json');

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#0A0B0F',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  initAutoUpdater(mainWindow);
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
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

ipcMain.handle('app:getVersion', () => app.getVersion());
