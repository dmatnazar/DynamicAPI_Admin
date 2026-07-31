import { useState } from 'react';
import { LayoutDashboard, Building2, Network, Settings as SettingsIcon } from 'lucide-react';
import { UpdateModal } from './components/UpdateModal';
import { DashboardPage } from './pages/Dashboard';
import { TenantsPage } from './pages/Tenants';
import { EndpointsPage } from './pages/Endpoints';
import { SettingsPage } from './pages/Settings';

type Tab = 'dashboard' | 'tenants' | 'endpoints' | 'settings';

const NAV: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'tenants', label: 'Tenants', icon: Building2 },
  { id: 'endpoints', label: 'API Builder', icon: Network },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard');

  return (
    <div className="flex h-screen bg-surface text-neutral-100 overflow-hidden">
      <UpdateModal />

      <aside className="w-56 border-r border-surface-border bg-surface-raised flex flex-col">
        <div className="px-4 py-5">
          <h1 className="text-sm font-bold tracking-tight">Dynamic API Admin</h1>
        </div>
        <nav className="flex-1 px-2 space-y-1">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition ${
                tab === id
                  ? 'bg-surface-card text-neutral-100'
                  : 'text-neutral-400 hover:bg-surface-card/60 hover:text-neutral-200'
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto">
        {tab === 'dashboard' && <DashboardPage />}
        {tab === 'tenants' && <TenantsPage />}
        {tab === 'endpoints' && <EndpointsPage />}
        {tab === 'settings' && <SettingsPage />}
      </main>
    </div>
  );
}
