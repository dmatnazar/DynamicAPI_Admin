import { RotateCcw } from 'lucide-react';

export function TitleBar() {
  return (
    <div
      className="h-9 shrink-0 flex items-center justify-between pl-3 pr-1 bg-surface-raised border-b border-surface-border select-none"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <span className="text-[11px] font-medium tracking-wide text-neutral-500">
        Dynamic API Admin
      </span>

      <div
        className="flex items-center gap-0.5"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {/* Minimize / maximize / close-to-tray removed on purpose — window
            chrome is hidden, so those live in the system tray's right-click
            menu (electron/tray.ts) instead. Restart is the only action that
            needs to be one click away from inside the app. */}
        <button
          title="Restart app"
          onClick={() => window.windowAPI.restartApp()}
          className="h-8 w-9 flex items-center justify-center text-neutral-500 hover:text-neutral-200 hover:bg-surface-card rounded transition"
        >
          <RotateCcw size={13} />
        </button>
      </div>
    </div>
  );
}
