import { Building2, Network, Wifi, WifiOff, Clock } from 'lucide-react';
import { useTenantStore } from '../store/useTenantStore';
import { useEndpointStore } from '../store/useEndpointStore';

export function DashboardPage() {
  const { tenants } = useTenantStore();
  const { endpointsByTenant } = useEndpointStore();

  const totalEndpoints = Object.values(endpointsByTenant).reduce((sum, arr) => sum + arr.length, 0);
  const allConnections = tenants.flatMap((t) => t.connections);
  const connected = allConnections.filter((c) => c.status === 'success').length;
  const failed = allConnections.filter((c) => c.status === 'failed').length;

  const stats = [
    { label: 'Companies', value: tenants.length, icon: Building2 },
    { label: 'Endpoints', value: totalEndpoints, icon: Network },
    { label: 'Connected DBs', value: connected, icon: Wifi },
    { label: 'Failed connections', value: failed, icon: WifiOff },
  ];

  const recentTenants = [...tenants].slice(-5).reverse();

  const statusOf = (tenantId: string) => {
    const t = tenants.find((x) => x.id === tenantId);
    return t?.connections.find((c) => c.id === t.activeConnectionId)?.status ?? 'unknown';
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-neutral-100">Dashboard</h2>
        <p className="text-xs text-neutral-500 mt-0.5">Overview of every company connected to this admin app.</p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-surface-border bg-surface-card p-4 sm:p-5 flex flex-col gap-2"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs text-neutral-500">{s.label}</p>
              <s.icon size={15} className="text-neutral-600" />
            </div>
            <p className="text-2xl sm:text-3xl font-semibold text-neutral-100">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="rounded-xl border border-surface-border bg-surface-card p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-neutral-100 mb-3">Recent companies</h3>
          {recentTenants.length === 0 ? (
            <p className="text-xs text-neutral-600 italic">No companies added yet.</p>
          ) : (
            <ul className="space-y-2">
              {recentTenants.map((t) => {
                const status = statusOf(t.id);
                return (
                  <li key={t.id} className="flex items-center justify-between text-sm gap-2">
                    <span className="text-neutral-200 truncate">{t.name}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${
                        status === 'success'
                          ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                          : status === 'failed'
                          ? 'text-red-400 border-red-500/30 bg-red-500/10'
                          : 'text-neutral-400 border-neutral-500/30 bg-neutral-500/10'
                      }`}
                    >
                      {status}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-surface-border bg-surface-card p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-neutral-100 mb-2 flex items-center gap-2">
            <Clock size={14} className="text-neutral-500" /> Getting started
          </h3>
          <ol className="list-decimal list-inside text-sm text-neutral-400 space-y-1.5">
            <li>Add a company in the Companies tab, then add its MSSQL connection(s).</li>
            <li>Build one or more API endpoints for that company in the API Builder tab.</li>
            <li>Click "One-Click Sync to VPS" to push the config live — no server restart needed.</li>
            <li>Configure the VPS Gateway address and sync options in Settings.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
