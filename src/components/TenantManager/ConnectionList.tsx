import { useState } from 'react';
import { Database, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import type { TenantConnection } from '../../types/endpoint.types';

interface Props {
  connections: TenantConnection[];
  onAdd: () => void;
  onEdit: (conn: TenantConnection) => void;
  onDelete: (conn: TenantConnection) => void;
  onSetPrimary: (conn: TenantConnection) => void;
  onTest: (conn: TenantConnection) => Promise<boolean>;
}

export function ConnectionList({
  connections,
  onAdd,
  onEdit,
  onDelete,
  onSetPrimary,
  onTest,
}: Props) {
  const [testingId, setTestingId] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, 'success' | 'failed'>>({});

  const runTest = async (conn: TenantConnection) => {
    setTestingId(conn.id);
    try {
      const ok = await onTest(conn);
      setResults((r) => ({ ...r, [conn.id]: ok ? 'success' : 'failed' }));
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-100 flex items-center gap-2">
          <Database size={14} className="text-emerald-400" />
          Baglanyşyklar
        </h3>
        <Button variant="ghost" className="!px-2.5 !py-1.5 !text-xs" onClick={onAdd}>
          <Plus size={14} className="mr-1 inline -mt-0.5" />
          Goş
        </Button>
      </div>

      {connections.length === 0 && (
        <p className="text-xs text-neutral-500 py-4 text-center border border-dashed border-surface-border rounded-lg">
          Entäk baglanyşyk ýok. «Goş» basyp Server / User / Password giriziň.
        </p>
      )}

      <div className="space-y-2">
        {connections.map((c) => {
          const testStatus = results[c.id] || c.connectionStatus;
          return (
            <div
              key={c.id}
              className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg border border-surface-border/60 p-3 bg-surface-raised/40"
            >
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-neutral-100">{c.label}</span>
                  {c.isPrimary && (
                    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
                      <Star size={10} /> Primary
                    </span>
                  )}
                  {testStatus !== 'unknown' && testStatus !== 'testing' && (
                    <Badge
                      status={testStatus === 'success' ? 'success' : 'failed'}
                      label={testStatus === 'success' ? 'OK' : 'Fail'}
                    />
                  )}
                </div>
                <p className="text-[11px] font-mono text-neutral-500 truncate">
                  {(c.dbType || 'mssql').toUpperCase()} · {c.host}:{c.port} / {c.database} · {c.username}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  className="!px-2 !py-1 !text-xs"
                  disabled={testingId === c.id}
                  onClick={() => void runTest(c)}
                >
                  {testingId === c.id ? '…' : 'Test'}
                </Button>
                {!c.isPrimary && (
                  <Button variant="ghost" className="!px-2 !py-1 !text-xs" onClick={() => onSetPrimary(c)} title="Primary et">
                    <Star size={13} />
                  </Button>
                )}
                <Button variant="ghost" className="!px-2 !py-1 !text-xs" onClick={() => onEdit(c)}>
                  <Pencil size={13} />
                </Button>
                <Button variant="ghost" className="!px-2 !py-1 !text-xs text-red-400" onClick={() => onDelete(c)}>
                  <Trash2 size={13} />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
