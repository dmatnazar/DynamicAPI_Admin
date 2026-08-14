import { Tray, Menu, nativeImage, BrowserWindow, app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

export type TrayConnectionStatus = 'ok' | 'partial' | 'offline';

interface TrayHooks {
  getWindow: () => BrowserWindow | null;
  onShow: () => void;
  onRestart: () => void;
  onQuit: () => void;
}

let tray: Tray | null = null;
let currentStatus: TrayConnectionStatus = 'offline';

const EMERGENCY_FALLBACK_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGklEQVR4nGNQuvzuPyWYYdSAUQNGDRguBgAAEtbiH+8clfcAAAAASUVORK5CYII=';

/** Resolve path to an icon under electron/assets/icons (dev + packaged). */
export function resolveIconPath(iconName: string): string {
  const devPath = path.join(__dirname, '..', 'electron', 'assets', 'icons', iconName);
  const packagedPath = path.join(process.resourcesPath, 'assets', 'icons', iconName);
  const candidate = app.isPackaged ? packagedPath : devPath;
  if (fs.existsSync(candidate)) return candidate;
  const fbDev = path.join(__dirname, '..', 'electron', 'assets', 'icons', 'fallback.ico');
  const fbPkg = path.join(process.resourcesPath, 'assets', 'icons', 'fallback.ico');
  const fb = app.isPackaged ? fbPkg : fbDev;
  return fs.existsSync(fb) ? fb : candidate;
}

function loadTrayImage(iconName: string) {
  const candidatePath = resolveIconPath(iconName);
  const img = nativeImage.createFromPath(candidatePath);
  if (!img.isEmpty()) {
    return img.resize({ width: 16, height: 16 });
  }
  return nativeImage.createFromDataURL(EMERGENCY_FALLBACK_DATA_URL).resize({ width: 16, height: 16 });
}

function iconForStatus(status: TrayConnectionStatus): string {
  if (status === 'ok') return 'tray-ok.ico';
  if (status === 'partial') return 'tray-partial.ico';
  return 'tray-offline.ico';
}

function tooltipForStatus(status: TrayConnectionStatus): string {
  if (status === 'ok') return 'BI Platform Client · VPS + DB bagly';
  if (status === 'partial') return 'BI Platform Client · bölekleýin baglanyşyk';
  return 'BI Platform Client · offline';
}

export function createTray(hooks: TrayHooks) {
  if (tray) return tray;

  tray = new Tray(loadTrayImage(iconForStatus(currentStatus)));
  tray.setToolTip(tooltipForStatus(currentStatus));

  const buildMenu = () => {
    const win = hooks.getWindow();
    const visible = !!win && win.isVisible();
    const statusLabel =
      currentStatus === 'ok'
        ? 'Status: OK (VPS + DB)'
        : currentStatus === 'partial'
          ? 'Status: Partial'
          : 'Status: Offline';

    return Menu.buildFromTemplate([
      { label: 'BI Platform Client', enabled: false },
      { label: statusLabel, enabled: false },
      { type: 'separator' },
      {
        label: visible ? 'Bring to front' : 'Show window',
        click: hooks.onShow,
      },
      {
        label: 'Hide window',
        enabled: visible,
        click: () => hooks.getWindow()?.hide(),
      },
      { type: 'separator' },
      { label: 'Restart app', click: hooks.onRestart },
      { label: 'Quit', click: hooks.onQuit },
    ]);
  };

  tray.on('click', hooks.onShow);
  tray.on('right-click', () => tray?.popUpContextMenu(buildMenu()));
  tray.setContextMenu(buildMenu());

  return tray;
}

/** Update tray icon + tooltip from renderer (VPS/DB health). */
export function setTrayStatus(status: TrayConnectionStatus) {
  currentStatus = status;
  if (!tray) return;
  tray.setImage(loadTrayImage(iconForStatus(status)));
  tray.setToolTip(tooltipForStatus(status));
}

export function destroyTray() {
  tray?.destroy();
  tray = null;
}
