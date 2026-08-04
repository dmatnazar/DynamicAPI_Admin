interface Props {
  value: string;
  onChange: (full: string) => void;
  prefix?: string;
  placeholder?: string;
  className?: string;
}

/** Phone input with fixed country prefix (default +993) */
export function PhoneInput({
  value,
  onChange,
  prefix = '+993',
  placeholder = '61 123456',
  className = '',
}: Props) {
  // Strip prefix if present for local display
  const local = value.startsWith(prefix)
    ? value.slice(prefix.length).trim()
    : value.replace(/^\+?\d{1,4}\s*/, '');

  return (
    <div className={`flex rounded-md border border-surface-border bg-surface-raised overflow-hidden focus-within:ring-1 focus-within:ring-blue-500/50 ${className}`}>
      <span className="shrink-0 px-2.5 py-2 text-sm font-mono text-neutral-400 bg-surface-card border-r border-surface-border select-none">
        {prefix}
      </span>
      <input
        type="tel"
        className="flex-1 min-w-0 bg-transparent px-3 py-2 text-sm outline-none"
        placeholder={placeholder}
        value={local}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^\d\s-]/g, '');
          onChange(digits ? `${prefix} ${digits}`.trim() : '');
        }}
      />
    </div>
  );
}
