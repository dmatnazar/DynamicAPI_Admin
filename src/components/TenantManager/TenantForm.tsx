import { useState } from 'react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import type { TenantConfig } from '../../types/endpoint.types';

interface Props {
  onCreate: (tenant: Omit<TenantConfig, 'id' | 'connectionStatus'>) => void;
}

export function TenantForm({ onCreate }: Props) {
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [connStr, setConnStr] = useState('');
  const [status, setStatus] = useState<'unknown' | 'testing' | 'success' | 'failed'>('unknown');

  const testConnection = async () => {
    setStatus('testing');
    // Real implementation: invoke an IPC handler (electron/ipc/db.ipc.ts) that
    // opens a short-lived `mssql.ConnectionPool(connStr)` in the main process
    // and resolves true/false. Wired here as a stub call site.
    try {
      await new Promise((r) => setTimeout(r, 900));
      setStatus(connStr.length > 10 ? 'success' : 'failed');
    } catch {
      setStatus('failed');
    }
  };

  const submit = () => {
    if (!slug || !name || !connStr) return;
    onCreate({ slug, name, dbConnectionString: connStr });
    setSlug('');
    setName('');
    setConnStr('');
    setStatus('unknown');
  };

  return (
    <div className="rounded-xl border border-surface-border bg-surface-card p-4 space-y-3">
      <h3 className="text-sm font-semibold text-neutral-100">New Company</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          className="bg-surface-raised border border-surface-border rounded-md px-3 py-2 text-sm w-full"
          placeholder="Company name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="bg-surface-raised border border-surface-border rounded-md px-3 py-2 text-sm font-mono w-full"
          placeholder="company-slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
        />
      </div>
      <textarea
        className="w-full bg-surface-raised border border-surface-border rounded-md px-3 py-2 text-sm font-mono"
        rows={2}
        placeholder="Server=...;Database=...;User Id=...;Password=...;"
        value={connStr}
        onChange={(e) => setConnStr(e.target.value)}
      />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={testConnection} disabled={!connStr}>
            Test Connection
          </Button>
          {status !== 'unknown' && (
            <Badge
              status={status}
              label={status === 'testing' ? 'Testing…' : status === 'success' ? 'Connected' : 'Failed'}
            />
          )}
        </div>
        <Button onClick={submit} disabled={!slug || !name || !connStr} className="w-full sm:w-auto">
          Add Company
        </Button>
      </div>
    </div>
  );
}
