import { useState } from 'react';
import { Plus, Trash2, Star, Pencil, Check, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useTenantStore } from '../../store/useTenantStore';
import uuid from '../../lib/uuid';
import type { TenantConfig } from '../../types/endpoint.types';

interface Props {
  tenant: TenantConfig;
}

export function TenantConnectionsPanel({ tenant }: Props) {
  const { addConnection, updateConnection, removeConnection, setPrimaryConnection } = useTenantStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draftLabel, setDraftLabel] = useState('');
  const [draftConnStr, setDraftConnStr] = useState('');
  const [testingId, setTestingId] = useState<string | null>(null);

  const startEdit = (id: string, label: string, connStr: string) => {
    setEditingId(id);
    setAdding(false);
    setDraftLabel(label);
    setDraftConnStr(connStr);
  };

  const startAdd = () => {
    setAdding(true);
    setEditingId(null);
    setDraftLabel('');
    setDraftConnStr('');
  };

  const cancel = () => {
    setEditingId(null);
    setAdding(false);
  };

  const saveEdit = () => {
    if (!editingId || !draftConnStr) return;
    updateConnection(tenant.id, editingId, {
      label: draftLabel || 'Connection',
      connectionString: draftConnStr,
    });
    cancel();
  };

  const saveAdd = () => {
    if (!draftConnStr) return;
    addConnection(tenant.id, {
      id: uuid.uuid(),
      label: draftLabel || `Connection ${tenant.connections.length + 1}`,
      connectionString: draftConnStr,
      isPrimary: tenant.connections.length === 0,
      connectionStatus: 'unknown',
    });
    cancel();
  };

  const testConnection = async (id: string) => {
    setTestingId(id);
    updateConnection(tenant.id, id, { connectionStatus: 'testing' });
    // Real implementation: invoke an IPC handler (electron/ipc/db.ipc.ts) that
    // opens a short-lived `mssql.ConnectionPool(connectionString)` in the
    // main process and resolves true/false. Stubbed here like TenantForm's
    // original "Test Connection" button.
    await new Promise((r) => setTimeout(r, 800));
    const conn = tenant.connections.find((c) => c.id === id);
    const ok = (conn?.connectionString.length ?? 0) > 10;
    updateConnection(tenant.id, id, { connectionStatus: ok ? 'success' : 'failed' });
    setTestingId(null);
  };

  return (
    <div className="rounded-xl border border-surface-border bg-surface-card p-4 sm:p-5 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-neutral-100">Connections — {tenant.name}</h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            Manage every MSSQL connection string for this company. The <span className="text-accent">primary</span>{' '}
            connection is the one used for live API queries and "One-Click Sync to VPS".
          </p>
        </div>
        <Button variant="ghost" onClick={startAdd} className="!p-1.5 shrink-0">
          <Plus size={16} />
        </Button>
      </div>

      <div className="space-y-2">
        {tenant.connections.map((c) =>
          editingId === c.id ? (
            <div key={c.id} className="rounded-lg border border-surface-border/60 p-3 space-y-2">
              <input
                className="w-full bg-surface-raised border border-surface-border rounded-md px-3 py-2 text-sm"
                placeholder="Label (e.g. Production, Reporting replica)"
                value={draftLabel}
                onChange={(e) => setDraftLabel(e.target.value)}
              />
              <textarea
                className="w-full bg-surface-raised border border-surface-border rounded-md px-3 py-2 text-sm font-mono"
                rows={2}
                placeholder="Server=...;Database=...;User Id=...;Password=...;"
                value={draftConnStr}
                onChange={(e) => setDraftConnStr(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={cancel} className="!px-3 !py-1.5 !text-xs">
                  <X size={14} />
                </Button>
                <Button onClick={saveEdit} className="!px-3 !py-1.5 !text-xs" disabled={!draftConnStr}>
                  <Check size={14} className="mr-1 inline -mt-0.5" /> Save
                </Button>
              </div>
            </div>
          ) : (
            <div
              key={c.id}
              className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg border border-surface-border/60 p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-neutral-100 truncate">{c.label}</span>
                  {c.isPrimary && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-accent">
                      <Star size={11} className="fill-accent" /> primary
                    </span>
                  )}
                  <Badge
                    status={c.connectionStatus}
                    label={
                      c.connectionStatus === 'testing'
                        ? 'Testing…'
                        : c.connectionStatus === 'success'
                        ? 'Connected'
                        : c.connectionStatus === 'failed'
                        ? 'Failed'
                        : 'Unknown'
                    }
                  />
                </div>
                <p className="text-xs font-mono text-neutral-500 truncate mt-0.5">{c.connectionString}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {!c.isPrimary && (
                  <Button
                    variant="ghost"
                    className="!px-2.5 !py-1.5 !text-xs"
                    onClick={() => setPrimaryConnection(tenant.id, c.id)}
                  >
                    Make primary
                  </Button>
                )}
                <Button
                  variant="secondary"
                  className="!px-2.5 !py-1.5 !text-xs"
                  onClick={() => testConnection(c.id)}
                  disabled={testingId === c.id}
                >
                  Test
                </Button>
                <button
                  onClick={() => startEdit(c.id, c.label, c.connectionString)}
                  className="p-1.5 text-neutral-500 hover:text-neutral-200"
                  title="Edit"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => removeConnection(tenant.id, c.id)}
                  className="p-1.5 text-neutral-500 hover:text-red-400"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          )
        )}

        {adding && (
          <div className="rounded-lg border border-dashed border-surface-border p-3 space-y-2">
            <input
              className="w-full bg-surface-raised border border-surface-border rounded-md px-3 py-2 text-sm"
              placeholder="Label (e.g. Production, Reporting replica)"
              value={draftLabel}
              onChange={(e) => setDraftLabel(e.target.value)}
            />
            <textarea
              className="w-full bg-surface-raised border border-surface-border rounded-md px-3 py-2 text-sm font-mono"
              rows={2}
              placeholder="Server=...;Database=...;User Id=...;Password=...;"
              value={draftConnStr}
              onChange={(e) => setDraftConnStr(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={cancel} className="!px-3 !py-1.5 !text-xs">
                Cancel
              </Button>
              <Button onClick={saveAdd} className="!px-3 !py-1.5 !text-xs" disabled={!draftConnStr}>
                Add connection
              </Button>
            </div>
          </div>
        )}

        {tenant.connections.length === 0 && !adding && (
          <p className="text-xs text-neutral-600 italic">No connections yet — add one above.</p>
        )}
      </div>
    </div>
  );
}
