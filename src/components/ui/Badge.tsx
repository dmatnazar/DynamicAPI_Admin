interface BadgeProps {
  status: 'success' | 'failed' | 'testing' | 'unknown' | 'active' | 'inactive';
  label: string;
}

const STYLES: Record<BadgeProps['status'], string> = {
  success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  failed: 'bg-red-500/10 text-red-400 border-red-500/30',
  testing: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  unknown: 'bg-neutral-500/10 text-neutral-400 border-neutral-500/30',
  inactive: 'bg-neutral-500/10 text-neutral-400 border-neutral-500/30',
};

export function Badge({ status, label }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
