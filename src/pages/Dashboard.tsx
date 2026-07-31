import { useTenantStore } from '../store/useTenantStore';
import { useEndpointStore } from '../store/useEndpointStore';

export function DashboardPage() {
  const { tenants } = useTenantStore();
  const { endpointsByTenant } = useEndpointStore();

  const totalEndpoints = Object.values(endpointsByTenant).reduce((sum, arr) => sum + arr.length, 0);

  const stats = [
    { label: 'Tenants', value: tenants.length },
    { label: 'Endpoints', value: totalEndpoints },
    { label: 'Active Connections', value: tenants.filter((t) => t.connectionStatus === 'success').length },
  ];

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-lg font-semibold text-neutral-100">Dashboard</h2>
      <div className="grid grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-surface-border bg-surface-card p-5">
            <p className="text-xs text-neutral-500">{s.label}</p>
            <p className="text-3xl font-semibold text-neutral-100 mt-1">{s.value}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-surface-border bg-surface-card p-5">
        <h3 className="text-sm font-semibold text-neutral-100 mb-2">Getting started</h3>
        <ol className="list-decimal list-inside text-sm text-neutral-400 space-y-1">
          <li>Add a tenant (company) with its MSSQL connection string in the Tenants tab.</li>
          <li>Build one or more API endpoints for that tenant in the Endpoints tab.</li>
          <li>Click "One-Click Sync to VPS" to push the config live — no server restart needed.</li>
        </ol>
      </div>
    </div>
  );
}
