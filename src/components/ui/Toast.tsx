import { create } from 'zustand';
import { useEffect } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export type ToastVariant = 'success' | 'warning' | 'error' | 'info';

export interface ToastItem {
  id: string;
  title: string;
  message?: string;
  variant: ToastVariant;
  durationMs: number;
}

interface ToastState {
  items: ToastItem[];
  push: (opts: {
    title: string;
    message?: string;
    variant?: ToastVariant;
    durationMs?: number;
  }) => string;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  items: [],
  push: ({ title, message, variant = 'info', durationMs = 5000 }) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    set((s) => ({
      items: [...s.items, { id, title, message, variant, durationMs }].slice(-6),
    }));
    if (durationMs > 0) {
      setTimeout(() => get().dismiss(id), durationMs);
    }
    return id;
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}));

/** Imperative helpers — usable from stores / sync engine */
export function toast(opts: {
  title: string;
  message?: string;
  variant?: ToastVariant;
  durationMs?: number;
}) {
  return useToastStore.getState().push(opts);
}

export function toastSuccess(title: string, message?: string) {
  return toast({ title, message, variant: 'success', durationMs: 5500 });
}
export function toastWarning(title: string, message?: string) {
  return toast({ title, message, variant: 'warning', durationMs: 7000 });
}
export function toastError(title: string, message?: string) {
  return toast({ title, message, variant: 'error', durationMs: 8000 });
}
export function toastInfo(title: string, message?: string) {
  return toast({ title, message, variant: 'info', durationMs: 5000 });
}

const STYLES: Record<
  ToastVariant,
  { border: string; bg: string; icon: typeof CheckCircle2; iconCls: string }
> = {
  success: {
    border: 'border-emerald-500/40',
    bg: 'bg-emerald-500/10',
    icon: CheckCircle2,
    iconCls: 'text-emerald-400',
  },
  warning: {
    border: 'border-amber-500/40',
    bg: 'bg-amber-500/10',
    icon: AlertTriangle,
    iconCls: 'text-amber-400',
  },
  error: {
    border: 'border-rose-500/40',
    bg: 'bg-rose-500/10',
    icon: XCircle,
    iconCls: 'text-rose-400',
  },
  info: {
    border: 'border-sky-500/40',
    bg: 'bg-sky-500/10',
    icon: Info,
    iconCls: 'text-sky-400',
  },
};

export function ToastHost() {
  const items = useToastStore((s) => s.items);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="fixed top-12 right-3 z-[100] flex flex-col gap-2 w-[min(360px,calc(100vw-1.5rem))] pointer-events-none">
      {items.map((t) => {
        const st = STYLES[t.variant];
        const Icon = st.icon;
        return (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-xl border ${st.border} ${st.bg} backdrop-blur-md shadow-xl shadow-black/40 px-3.5 py-3 flex gap-3 animate-[toastIn_0.25s_ease-out]`}
            role="status"
          >
            <Icon size={18} className={`${st.iconCls} shrink-0 mt-0.5`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-neutral-100 leading-snug">{t.title}</p>
              {t.message && (
                <p className="text-xs text-neutral-400 mt-0.5 leading-relaxed whitespace-pre-wrap">
                  {t.message}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="shrink-0 h-6 w-6 flex items-center justify-center rounded-md text-neutral-500 hover:text-neutral-200 hover:bg-white/5"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(12px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
