import { autoUpdater } from 'electron-updater';
import { BrowserWindow, ipcMain, app } from 'electron';
import log from 'electron-log';
import path from 'node:path';
import fs from 'node:fs';

autoUpdater.logger = log;
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;
// Allow channel / prerelease if needed later
autoUpdater.allowPrerelease = false;

/** Default public update folder on your VPS (no trailing slash required). */
const DEFAULT_UPDATE_URL = 'https://YOUR_VPS_DOMAIN/updates';

function readUpdateUrlFromDisk(): string | null {
  try {
    // Optional override file next to userData
    const p = path.join(app.getPath('userData'), 'update-feed.json');
    if (fs.existsSync(p)) {
      const j = JSON.parse(fs.readFileSync(p, 'utf8')) as { url?: string };
      if (j.url && /^https?:\/\//i.test(j.url)) return j.url.replace(/\/$/, '');
    }
  } catch {
    /* ignore */
  }
  return null;
}

function configureFeed() {
  // Priority: env → userData/update-feed.json → default constant
  const fromEnv = (process.env.UPDATE_FEED_URL || '').trim().replace(/\/$/, '');
  const fromFile = readUpdateUrlFromDisk();
  const url = fromEnv || fromFile || DEFAULT_UPDATE_URL;

  // Skip clearly-placeholder URLs in production so we don't spam errors
  if (!url || url.includes('YOUR_VPS_DOMAIN')) {
    log.warn('[updater] UPDATE_FEED_URL not configured — set env or userData/update-feed.json');
    return false;
  }

  autoUpdater.setFeedURL({
    provider: 'generic',
    url,
    // Windows uses latest.yml at {url}/latest.yml
  });
  log.info('[updater] feed URL =', url);
  return true;
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
      return { ok: false, message: 'Update feed URL not configured' };
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

  ipcMain.handle('updater:setFeedUrl', (_e, url: string) => {
    if (!url || !/^https?:\/\//i.test(url)) {
      return { ok: false, message: 'Invalid URL' };
    }
    const clean = url.replace(/\/$/, '');
    try {
      const p = path.join(app.getPath('userData'), 'update-feed.json');
      fs.writeFileSync(p, JSON.stringify({ url: clean }, null, 2), 'utf8');
      autoUpdater.setFeedURL({ provider: 'generic', url: clean });
      log.info('[updater] feed URL updated =', clean);
      return { ok: true };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.handle('updater:getFeedUrl', () => {
    const fromFile = readUpdateUrlFromDisk();
    return fromFile || process.env.UPDATE_FEED_URL || DEFAULT_UPDATE_URL;
  });

  // Only auto-check when packaged (installer build), not in vite dev
  if (app.isPackaged && (feedOk || configureFeed())) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(() => {});
    }, 4000);
    setInterval(() => {
      autoUpdater.checkForUpdates().catch(() => {});
    }, 4 * 60 * 60 * 1000);
  }
}
