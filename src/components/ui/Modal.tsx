import { X } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
  title: string;
  onClose?: () => void;
  children: ReactNode;
  footer?: ReactNode;
  widthClass?: string;
}

export function Modal({ title, onClose, children, footer, widthClass = 'max-w-lg' }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />
      <div
        className={`relative w-full ${widthClass} rounded-xl border border-surface-border bg-surface-raised shadow-2xl shadow-black/50 my-8 sm:my-0`}
      >
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-surface-border">
          <h3 className="text-sm font-semibold text-neutral-100">{title}</h3>
          {onClose && (
            <button
              onClick={onClose}
              className="h-7 w-7 flex items-center justify-center rounded-md text-neutral-500 hover:text-neutral-200 hover:bg-surface-card transition"
            >
              <X size={15} />
            </button>
          )}
        </div>
        <div className="px-4 sm:px-5 py-4 space-y-3.5 max-h-[70vh] overflow-y-auto">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 px-4 sm:px-5 py-3.5 border-t border-surface-border">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
