import { autoUpdater } from 'electron-updater';
import { BrowserWindow, ipcMain, app, safeStorage } from 'electron';
import log from 'electron-log';
import path from 'node:path';
import fs from 'node:fs';

autoUpdater.logger = log;
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.allowPrerelease = false;

export interface UpdateFeedConfig {
  protocol: 'http' | 'https';
  host: string;
  port?: number | string;
  path: string;
  username?: string;
  password?: string;
}

const DEFAULT_UPDATE_URL = 'https://216.250.13.39/updates';

function getFeedConfigPath(): string {
  return path.join(app.getPath('userData'), 'update-feed-config.json');
}

export function readFeedConfig(): UpdateFeedConfig {
  const p = getFeedConfigPath();
  if (fs.existsSync(p)) {
    try {
      const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
      let password = raw.password || '';
      if (raw.passwordEnc && safeStorage.isEncryptionAvailable()) {
        try {
          password = safeStorage.decryptString(Buffer.from(raw.passwordEnc, 'base64'));
        } catch {
          /* ignore */
        }
      }
      return {
        protocol: raw.protocol || 'https',
        host: raw.host || '216.250.13.39',
        port: raw.port || '',
        path: raw.path || '/updates',
        username: raw.username || '',
        password,
      };
    } catch {
      /* fallback */
    }
  }
  return {
    protocol: 'https',
    host: '216.250.13.39',
    port: '',
    path: '/updates',
    username: '',
    password: '',
  };
}

export function saveFeedConfig(cfg: UpdateFeedConfig) {
  const p = getFeedConfigPath();
  const toSave: any = {
    protocol: cfg.protocol || 'https',
    host: cfg.host.trim(),
    port: cfg.port || '',
    path: cfg.path.startsWith('/') ? cfg.path : `/${cfg.path}`,
    username: cfg.username?.trim() || '',
  };

  if (cfg.password && safeStorage.isEncryptionAvailable()) {
    toSave.passwordEnc = safeStorage.encryptString(cfg.password).toString('base64');
  } else if (cfg.password) {
    toSave.password = cfg.password;
  }

  fs.writeFileSync(p, JSON.stringify(toSave, null, 2), 'utf8');
}

export function constructFeedUrl(cfg: UpdateFeedConfig): string {
  const host = cfg.host.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  const portPart = cfg.port ? `:${cfg.port}` : '';
  const cleanPath = (cfg.path || '/updates').startsWith('/') ? cfg.path : `/${cfg.path}`;
  return `${cfg.protocol}://${host}${portPart}${cleanPath}`;
}

function configureFeed(): boolean {
  const cfg = readFeedConfig();
  if (!cfg.host) {
    log.warn('[updater] Update host is not configured.');
    return false;
  }

  const url = constructFeedUrl(cfg);
  const requestHeaders: Record<string, string> = {};

  if (cfg.username && cfg.password) {
    const creds = Buffer.from(`${cfg.username}:${cfg.password}`).toString('base64');
    requestHeaders['Authorization'] = `Basic ${creds}`;
  }

  try {
    autoUpdater.setFeedURL({
      provider: 'generic',
      url,
      requestHeaders,
    });
    log.info('[updater] Configured feed URL =', url);
    return true;
  } catch (err) {
    log.error('[updater] Failed to configure feed:', err);
    return false;
  }
}

export function initAutoUpdater(mainWindow: BrowserWindow) {
  const send = (channel: string, payload?: unknown) => {
    if (!mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
  };

  const feedOk = configureFeed();

  autoUpdater.on('checking-for-update', () => send('updater:checking'));

  autoUpdater.on('update-available', (info) => {
    const notes =
      typeof info.releaseNotes === 'string'
        ? info.releaseNotes
        : Array.isArray(info.releaseNotes)
          ? info.releaseNotes.map((n) => (typeof n === 'string' ? n : n.note || '')).join('\n')
          : '';
    send('updater:available', {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: notes || undefined,
    });
  });

  autoUpdater.on('update-not-available', () => send('updater:none'));

  autoUpdater.on('download-progress', (progress) => {
    send('updater:progress', {
      percent: Math.round(progress.percent),
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    send('updater:downloaded', {
      version: info.version,
      releaseNotes:
        typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined,
    });
  });

  autoUpdater.on('error', (err) => {
    log.error('[updater]', err);
    send('updater:error', { message: err?.message || String(err) });
  });

  ipcMain.handle('updater:check', async () => {
    if (!feedOk && !configureFeed()) {
      return { ok: false, message: 'Update feed sazlanmadyk' };
    }
    try {
      const r = await autoUpdater.checkForUpdates();
      return { ok: true, version: r?.updateInfo?.version };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      log.error(e);
      return { ok: false, message };
    }
  });

  ipcMain.handle('updater:download', () => autoUpdater.downloadUpdate());
  ipcMain.handle('updater:install', () => {
    setImmediate(() => autoUpdater.quitAndInstall(false, true));
  });

  ipcMain.handle('updater:getConfig', () => {
    return readFeedConfig();
  });

  ipcMain.handle('updater:saveConfig', (_e, cfg: UpdateFeedConfig) => {
    saveFeedConfig(cfg);
    const ok = configureFeed();
    return { ok, url: constructFeedUrl(cfg) };
  });

  // Legacy setFeedUrl compatibility
  ipcMain.handle('updater:setFeedUrl', (_e, url: string) => {
    try {
      const parsed = new URL(url);
      saveFeedConfig({
        protocol: parsed.protocol.replace(':', '') as any,
        host: parsed.hostname,
        port: parsed.port || '',
        path: parsed.pathname,
      });
      configureFeed();
      return { ok: true };
    } catch (e) {
      return { ok: false, message: 'Invalid URL' };
    }
  });

  ipcMain.handle('updater:getFeedUrl', () => {
    const cfg = readFeedConfig();
    return constructFeedUrl(cfg);
  });

  if (app.isPackaged && (feedOk || configureFeed())) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(() => {});
    }, 4000);
    setInterval(() => {
      autoUpdater.checkForUpdates().catch(() => {});
    }, 4 * 60 * 60 * 1000);
  }
}
