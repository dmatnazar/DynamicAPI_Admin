import { Tray, Menu, nativeImage, BrowserWindow, app } from 'electron';
import path from 'node:path';

interface TrayHooks {
  getWindow: () => BrowserWindow | null;
  onShow: () => void;
  onRestart: () => void;
  onQuit: () => void;
}

let tray: Tray | null = null;

// A tiny built-in fallback icon (16x16 transparent-safe dot) so the tray
// still works even before you drop a real icon into /build. Replace
// `build/tray-icon.png` (and tray-icon@2x.png for retina) with your own art —
// this path is what electron-builder also packages as the app icon source.
const FALLBACK_ICON_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGklEQVR4nGNQuvzuPyWYYdSAUQNGDRguBgAAEtbiH+8clfcAAAAASUVORK5CYII=';

function resolveIcon() {
  const packagedPath = path.join(process.resourcesPath ?? '', 'build', 'tray-icon.png');
  const devPath = path.join(__dirname, '../build/tray-icon.png');
  const candidate = app.isPackaged ? packagedPath : devPath;

  const img = nativeImage.createFromPath(candidate);
  if (!img.isEmpty()) return img.resize({ width: 16, height: 16 });

  return nativeImage.createFromDataURL(FALLBACK_ICON_DATA_URL).resize({ width: 16, height: 16 });
}

export function createTray(hooks: TrayHooks) {
  if (tray) return tray;

  tray = new Tray(resolveIcon());
  tray.setToolTip('Dynamic API Admin');

  const buildMenu = () => {
    const win = hooks.getWindow();
    const visible = !!win && win.isVisible();

    return Menu.buildFromTemplate([
      { label: 'Dynamic API Admin', enabled: false },
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

export function destroyTray() {
  tray?.destroy();
  tray = null;
}
