import { create } from 'zustand';
import { AlertTriangle, Info, CheckCircle2, XCircle, X } from 'lucide-react';
import { Button } from './Button';

type DialogVariant = 'confirm' | 'alert' | 'success' | 'error' | 'info';

interface DialogState {
  open: boolean;
  variant: DialogVariant;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  danger: boolean;
  resolve: ((ok: boolean) => void) | null;
  show: (opts: {
    title: string;
    message: string;
    variant?: DialogVariant;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
  }) => Promise<boolean>;
  close: (ok: boolean) => void;
}

export const useDialogStore = create<DialogState>((set, get) => ({
  open: false,
  variant: 'confirm',
  title: '',
  message: '',
  confirmLabel: 'OK',
  cancelLabel: 'Ýatyr',
  danger: false,
  resolve: null,

  show: ({ title, message, variant = 'confirm', confirmLabel, cancelLabel, danger }) => {
    // Öňki açyk Promise bar bolsa, ony resolve(false) edip ýapýarys
    const currentResolve = get().resolve;
    if (currentResolve) {
      currentResolve(false);
    }
    return new Promise<boolean>((resolve) => {
      const isDangerous =
        danger ?? (variant === 'confirm' && /poz|delete|remove/i.test(title + message));
      set({
        open: true,
        title,
        message,
        variant,
        confirmLabel: confirmLabel ?? (variant === 'confirm' ? 'Hawa' : 'OK'),
        cancelLabel: cancelLabel ?? 'Ýatyr',
        danger: isDangerous,
        resolve,
      });
    });
  },

  close: (ok) => {
    const { resolve } = get();
    set({ open: false, resolve: null });
    resolve?.(ok);
  },
}));

export function confirmDialog(opts: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}): Promise<boolean> {
  return useDialogStore.getState().show({ ...opts, variant: 'confirm' });
}

export function alertDialog(opts: {
  title: string;
  message: string;
  variant?: 'alert' | 'success' | 'error' | 'info';
  confirmLabel?: string;
}): Promise<boolean> {
  return useDialogStore.getState().show({
    ...opts,
    variant: opts.variant ?? 'alert',
    confirmLabel: opts.confirmLabel ?? 'OK',
  });
}

const ICONS: Record<DialogVariant, typeof Info> = {
  confirm: AlertTriangle,
  alert: Info,
  info: Info,
  success: CheckCircle2,
  error: XCircle,
};

const ICON_COLOR: Record<DialogVariant, string> = {
  confirm: 'text-amber-400',
  alert: 'text-blue-400',
  info: 'text-blue-400',
  success: 'text-emerald-400',
  error: 'text-red-400',
};

export function ConfirmDialogHost() {
  const { open, variant, title, message, confirmLabel, cancelLabel, danger, close } =
    useDialogStore();

  if (!open) return null;

  const Icon = ICONS[variant];
  const isConfirm = variant === 'confirm';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-[2px]" onClick={() => close(false)} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md rounded-2xl border border-surface-border bg-surface-raised shadow-2xl shadow-black/60 overflow-hidden"
      >
        <button
          type="button"
          onClick={() => close(false)}
          className="absolute right-3 top-3 h-7 w-7 flex items-center justify-center rounded-md text-neutral-500 hover:text-neutral-200 hover:bg-surface-card"
        >
          <X size={14} />
        </button>

        <div className="px-5 pt-5 pb-4 flex gap-3">
          <div
            className={`shrink-0 h-10 w-10 rounded-xl flex items-center justify-center bg-surface-card border border-surface-border ${ICON_COLOR[variant]}`}
          >
            <Icon size={20} />
          </div>
          <div className="min-w-0 pt-0.5">
            <h3 className="text-sm font-semibold text-neutral-100 pr-6">{title}</h3>
            <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed whitespace-pre-wrap">{message}</p>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-surface-border bg-surface-card/40">
          {isConfirm && (
            <Button variant="ghost" className="!text-xs" onClick={() => close(false)}>
              {cancelLabel}
            </Button>
          )}
          <Button
            variant={danger && isConfirm ? 'danger' : 'primary'}
            className="!text-xs min-w-[4.5rem]"
            onClick={() => close(true)}
            autoFocus
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
