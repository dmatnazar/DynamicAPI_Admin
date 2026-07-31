import { Minus, Square, X, RotateCcw } from 'lucide-react';

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
        <button
          title="Restart app"
          onClick={() => window.windowAPI.restartApp()}
          className="h-8 w-9 flex items-center justify-center text-neutral-500 hover:text-neutral-200 hover:bg-surface-card rounded transition"
        >
          <RotateCcw size={13} />
        </button>
        <button
          title="Minimize"
          onClick={() => window.windowAPI.minimize()}
          className="h-8 w-9 flex items-center justify-center text-neutral-500 hover:text-neutral-200 hover:bg-surface-card rounded transition"
        >
          <Minus size={14} />
        </button>
        <button
          title="Maximize / Restore"
          onClick={() => window.windowAPI.maximizeToggle()}
          className="h-8 w-9 flex items-center justify-center text-neutral-500 hover:text-neutral-200 hover:bg-surface-card rounded transition"
        >
          <Square size={11} />
        </button>
        <button
          title="Close to tray"
          onClick={() => window.windowAPI.hide()}
          className="h-8 w-9 flex items-center justify-center text-neutral-500 hover:text-white hover:bg-red-600 rounded transition"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
