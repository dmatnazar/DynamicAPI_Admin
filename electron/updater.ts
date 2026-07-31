import { autoUpdater } from 'electron-updater';
import { BrowserWindow, ipcMain } from 'electron';
import log from 'electron-log';

autoUpdater.logger = log;
autoUpdater.autoDownload = false; // controlled from renderer so we can show progress UI
autoUpdater.autoInstallOnAppQuit = true;

export function initAutoUpdater(mainWindow: BrowserWindow) {
  const send = (channel: string, payload?: unknown) => {
    if (!mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
  };

  autoUpdater.on('checking-for-update', () => send('updater:checking'));

  autoUpdater.on('update-available', (info) => {
    send('updater:available', { version: info.version });
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
    send('updater:downloaded', { version: info.version });
  });

  autoUpdater.on('error', (err) => {
    send('updater:error', { message: err.message });
  });

  ipcMain.handle('updater:check', () => autoUpdater.checkForUpdates().catch((e) => log.error(e)));
  ipcMain.handle('updater:download', () => autoUpdater.downloadUpdate());
  ipcMain.handle('updater:install', () => {
    setImmediate(() => autoUpdater.quitAndInstall(false, true));
  });

  // Check on launch, then every 4 hours. Wrapped in try/catch — in dev mode
  // (unpackaged) electron-updater has no feed configured and would throw.
  try {
    autoUpdater.checkForUpdates().catch(() => {});
  } catch {
    /* no-op in dev */
  }
  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 4 * 60 * 60 * 1000);
}
