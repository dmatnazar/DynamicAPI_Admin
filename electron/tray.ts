import { Tray, Menu, nativeImage, BrowserWindow, app } from 'electron';
import path from 'node:path';

interface TrayHooks {
  getWindow: () => BrowserWindow | null;
  onShow: () => void;
  onRestart: () => void;
  onQuit: () => void;
}

let tray: Tray | null = null;

// Emergency 16x16 transparent base64 fallback in case no file exists on disk
const EMERGENCY_FALLBACK_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGklEQVR4nGNQuvzuPyWYYdSAUQNGDRguBgAAEtbiH+8clfcAAAAASUVORK5CYII=';

function resolveIcon() {
  const iconName = 'fallback.ico';

  // Dev path: moves up from 'dist-electron' into 'electron/assets/icons/'
  const devPath = path.join(__dirname, '..', 'electron', 'assets', 'icons', iconName);

  // Packaged path: inside electron resources folder
  const packagedPath = path.join(process.resourcesPath, 'assets', 'icons', iconName);

  const candidatePath = app.isPackaged ? packagedPath : devPath;
  console.log('Attempting to load icon from:', candidatePath);

  // 1. Try loading from file path
  const img = nativeImage.createFromPath(candidatePath);
  if (!img.isEmpty()) {
    return img.resize({ width: 16, height: 16 });
  }

  console.warn('Icon file not found or empty. Falling back to base64 icon.');

  // 2. Hard fallback if file fails to load
  return nativeImage
    .createFromDataURL(EMERGENCY_FALLBACK_DATA_URL)
    .resize({ width: 16, height: 16 });
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