interface Props {
  value: string;
  onChange: (full: string) => void;
  className?: string;
}

/** Website input with http/https protocol selector */
export function WebsiteInput({ value, onChange, className = '' }: Props) {
  const isHttps = !value.startsWith('http://');
  const protocol = isHttps ? 'https://' : 'http://';
  const host = value.replace(/^https?:\/\//i, '');

  const setProtocol = (https: boolean) => {
    const p = https ? 'https://' : 'http://';
    onChange(host ? `${p}${host}` : '');
  };

  return (
    <div className={`flex rounded-md border border-surface-border bg-surface-raised overflow-hidden focus-within:ring-1 focus-within:ring-blue-500/50 ${className}`}>
      <div className="flex shrink-0 border-r border-surface-border">
        <button
          type="button"
          onClick={() => setProtocol(true)}
          className={`px-2 py-2 text-[11px] font-mono transition ${
            isHttps ? 'bg-emerald-500/15 text-emerald-300' : 'text-neutral-500 hover:text-neutral-300'
          }`}
        >
          https://
        </button>
        <button
          type="button"
          onClick={() => setProtocol(false)}
          className={`px-2 py-2 text-[11px] font-mono border-l border-surface-border transition ${
            !isHttps ? 'bg-amber-500/15 text-amber-300' : 'text-neutral-500 hover:text-neutral-300'
          }`}
        >
          http://
        </button>
      </div>
      <input
        type="text"
        className="flex-1 min-w-0 bg-transparent px-3 py-2 text-sm outline-none"
        placeholder="example.com"
        value={host}
        onChange={(e) => {
          const h = e.target.value.replace(/^https?:\/\//i, '');
          onChange(h ? `${protocol}${h}` : '');
        }}
      />
    </div>
  );
}
