import type { EndpointConfig } from '../../types/endpoint.types';
import { Badge } from '../ui/Badge';

interface Props {
  endpoints: EndpointConfig[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

const METHOD_COLORS: Record<string, string> = {
  GET: 'text-emerald-400',
  POST: 'text-accent',
  PUT: 'text-amber-400',
  DELETE: 'text-red-400',
};

export function EndpointList({ endpoints, activeId, onSelect }: Props) {
  return (
    <div className="space-y-1">
      {endpoints.map((ep) => (
        <button
          key={ep.id}
          onClick={() => onSelect(ep.id)}
          className={`w-full text-left px-3 py-2 rounded-lg border transition ${
            activeId === ep.id
              ? 'bg-surface-card border-surface-border'
              : 'border-transparent hover:bg-surface-card/60'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold ${METHOD_COLORS[ep.method]}`}>{ep.method}</span>
            <span className="text-sm text-neutral-200 truncate">{ep.name}</span>
          </div>
          <p className="text-xs text-neutral-500 truncate mt-0.5">{ep.pathTemplate}</p>
          <div className="mt-1.5">
            <Badge status={ep.authRequired ? 'active' : 'unknown'} label={ep.authRequired ? 'Auth' : 'Public'} />
          </div>
        </button>
      ))}
      {endpoints.length === 0 && (
        <p className="text-xs text-neutral-600 italic px-3 py-2">No endpoints yet. Create one to get started.</p>
      )}
    </div>
  );
}
