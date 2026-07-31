import { useState } from 'react';
import { Database, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { DB_TYPE_LABELS, type DbConnection } from '../../types/endpoint.types';

interface Props {
  connections: DbConnection[];
  activeConnectionId: string | null;
  onAdd: () => void;
  onEdit: (conn: DbConnection) => void;
  onDelete: (conn: DbConnection) => void;
  onSetActive: (conn: DbConnection) => void;
  onTest: (conn: DbConnection) => Promise<boolean>;
}

export function ConnectionList({
  connections,
  activeConnectionId,
  onAdd,
  onEdit,
  onDelete,
  onSetActive,
  onTest,
}: Props) {
  const [testingId, setTestingId] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, 'success' | 'failed'>>({});

  const runTest = async (conn: DbConnection) => {
    setTestingId(conn.id);
    const ok = await onTest(conn);
    setResults((r) => ({ ...r, [conn.id]: ok ? 'success' : 'failed' }));
    setTestingId(null);
  };

  return (
    <div className="rounded-xl border border-surface-border bg-surface-card p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database size={16} className="text-accent" />
          <h3 className="text-sm font-semibold text-neutral-100">Database Connectionlar</h3>
        </div>
        <Button variant="ghost" className="!px-2 !py-1.5 !text-xs" onClick={onAdd}>
          <Plus size={14} className="inline -mt-0.5 mr-1" />
          Connection goş
        </Button>
      </div>

      {connections.length === 0 && (
        <p className="text-xs text-neutral-600 italic">
          Entek connection ýok — "Connection goş" bilen ilkinji MSSQL baglanyşygyňy goş.
        </p>
      )}

      <div className="space-y-2">
        {connections.map((c) => {
          const testStatus = results[c.id];
          const isActive = c.id === activeConnectionId;
          return (
            <div
              key={c.id}
              className={`rounded-lg border p-3 space-y-2 ${
                isActive ? 'border-accent/50 bg-surface-raised' : 'border-surface-border/70'
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                {isActive && <Star size={13} className="text-accent shrink-0" />}
                <span className="text-sm font-medium text-neutral-100 truncate">{c.connectionName}</span>
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-surface-border text-neutral-400">
                  {DB_TYPE_LABELS[c.dbType]}
                </span>
                {testingId === c.id ? (
                  <Badge status="testing" label="Barlanýar…" />
                ) : (
                  testStatus && (
                    <Badge status={testStatus} label={testStatus === 'success' ? 'Baglandy' : 'Şowsuz'} />
                  )
                )}
                <div className="flex-1" />
                {!isActive && (
                  <button
                    onClick={() => onSetActive(c)}
                    className="text-[11px] text-neutral-500 hover:text-accent"
                  >
                    Esasy et
                  </button>
                )}
              </div>
              <p className="text-xs font-mono text-neutral-500 truncate">
                {c.username}@{c.host}:{c.port}/{c.database}
              </p>
              <div className="flex flex-wrap gap-2 pt-0.5">
                <Button
                  variant="secondary"
                  className="!px-2.5 !py-1 !text-xs"
                  onClick={() => runTest(c)}
                  disabled={testingId === c.id}
                >
                  {testingId === c.id ? 'Barlanýar…' : 'Test et'}
                </Button>
                <Button variant="ghost" className="!px-2.5 !py-1 !text-xs" onClick={() => onEdit(c)}>
                  <Pencil size={12} className="inline -mt-0.5 mr-1" />
                  Üýtget
                </Button>
                <Button
                  variant="ghost"
                  className="!px-2.5 !py-1 !text-xs !text-red-400"
                  onClick={() => onDelete(c)}
                >
                  <Trash2 size={12} className="inline -mt-0.5 mr-1" />
                  Poz
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
