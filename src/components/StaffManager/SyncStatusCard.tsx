import { useState } from 'react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { syncToVps } from '../../lib/api';
import type { TenantConfig, EndpointConfig } from '../../types/endpoint.types';
import { hasPrimaryConnection } from '../../types/endpoint.types';

interface Props {
  gatewayUrl: string;
  deviceId: string;
  deviceSecret: string;
  tenant: TenantConfig | null;
  endpoints: EndpointConfig[];
}

export function SyncStatusCard({ gatewayUrl, deviceId, deviceSecret, tenant, endpoints }: Props) {
  const [state, setState] = useState<'idle' | 'syncing' | 'success' | 'failed'>('idle');
  const [message, setMessage] = useState('');

  const hasConn = hasPrimaryConnection(tenant);

  const handleSync = async () => {
    if (!tenant) return;
    setState('syncing');
    try {
      const result = await syncToVps(gatewayUrl, deviceId, deviceSecret, tenant, endpoints, true);
      setMessage(
        `${result.endpointsLoaded} endpoint(s) synced at ${new Date(result.syncedAt).toLocaleTimeString()}`
      );
      setState('success');
    } catch (err) {
      setMessage((err as Error).message);
      setState('failed');
    }
  };

  return (
    <div className="rounded-xl border border-surface-border bg-surface-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-100">Sync to VPS Gateway</h3>
        {state !== 'idle' && (
          <Badge
            status={state === 'syncing' ? 'testing' : state}
            label={state === 'syncing' ? 'Syncing…' : state === 'success' ? 'Synced' : 'Failed'}
          />
        )}
      </div>
      <p className="text-xs text-neutral-500">
        Target: <span className="font-mono text-neutral-400">{gatewayUrl}</span>
      </p>
      {tenant && !hasConn && (
        <p className="text-xs text-amber-400">
          Bu kompaniýada işjeň (esasy) database connection ýok — Companies sahypasynda goş.
        </p>
      )}
      {tenant && hasConn && (
        <p className="text-xs text-neutral-500">
          Primary DB:{' '}
          <span className="font-mono text-neutral-300">
            {(tenant.connections.find((c) => c.isPrimary) ?? tenant.connections[0])?.host}:
            {(tenant.connections.find((c) => c.isPrimary) ?? tenant.connections[0])?.port}/
            {(tenant.connections.find((c) => c.isPrimary) ?? tenant.connections[0])?.database}
          </span>
        </p>
      )}
      {message && <p className="text-xs text-neutral-400 break-words">{message}</p>}
      <Button
        onClick={handleSync}
        disabled={!tenant || !hasConn || state === 'syncing'}
        className="w-full"
      >
        {state === 'syncing' ? 'Syncing…' : 'One-Click Sync to VPS'}
      </Button>
    </div>
  );
}
