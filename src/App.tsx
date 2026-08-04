import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Building2,
  Users,
  Network,
  Settings as SettingsIcon,
  Menu as MenuIcon,
} from 'lucide-react';
import { TitleBar } from './components/TitleBar';
import { UpdateModal } from './components/UpdateModal';
import { DashboardPage } from './pages/Dashboard';
import { TenantsPage } from './pages/Tenants';
import { StaffPage } from './pages/Staff';
import { EndpointsPage } from './pages/Endpoints';
import { SettingsPage } from './pages/Settings';
import { hydrateStoresFromLocalDb } from './lib/hydrateStores';
import { ConfirmDialogHost } from './components/ui/ConfirmDialog';


type Tab = 'dashboard' | 'tenants' | 'staff' | 'endpoints' | 'settings';

const NAV: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'tenants', label: 'Companies', icon: Building2 },
  { id: 'staff', label: 'Işgärler', icon: Users },
  { id: 'endpoints', label: 'API Builder', icon: Network },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

const COLLAPSE_BREAKPOINT = 860;

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [collapsed, setCollapsed] = useState(window.innerWidth < COLLAPSE_BREAKPOINT);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    void hydrateStoresFromLocalDb();
  }, []);

  useEffect(() => {
    const onResize = () => {
      const shouldCollapse = window.innerWidth < COLLAPSE_BREAKPOINT;
      setCollapsed(shouldCollapse);
      if (!shouldCollapse) setMobileNavOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const selectTab = (id: Tab) => {
    setTab(id);
    setMobileNavOpen(false);
  };

  return (
    <div className="flex flex-col h-screen bg-surface text-neutral-100 overflow-hidden">
      <TitleBar />
      <UpdateModal />
      <ConfirmDialogHost />

      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        {/* Sidebar (icon-only when collapsed, full drawer on mobile toggle) */}
        <aside
          className={`shrink-0 border-r border-surface-border bg-surface-raised flex flex-col transition-all duration-150 z-20
            ${collapsed ? 'w-14' : 'w-56'}
            ${collapsed && mobileNavOpen ? 'absolute inset-y-0 left-0 w-56 shadow-2xl shadow-black/50' : ''}
          `}
        >
          <div className="h-12 flex items-center justify-between px-3">
            {(!collapsed || mobileNavOpen) && (
              <h1 className="text-xs font-bold tracking-tight truncate">Dynamic API Admin</h1>
            )}
            {collapsed && (
              <button
                onClick={() => setMobileNavOpen((v) => !v)}
                className="h-7 w-7 flex items-center justify-center rounded-md text-neutral-400 hover:bg-surface-card hover:text-neutral-100 mx-auto"
                title="Menu"
              >
                <MenuIcon size={16} />
              </button>
            )}
          </div>
          <nav className="flex-1 px-2 space-y-1 overflow-y-auto">
            {NAV.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => selectTab(id)}
                title={label}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition ${
                  collapsed && !mobileNavOpen ? 'justify-center px-0' : ''
                } ${
                  tab === id
                    ? 'bg-surface-card text-neutral-100'
                    : 'text-neutral-400 hover:bg-surface-card/60 hover:text-neutral-200'
                }`}
              >
                <Icon size={16} className="shrink-0" />
                {(!collapsed || mobileNavOpen) && <span className="truncate">{label}</span>}
              </button>
            ))}
          </nav>
        </aside>

        {/* Backdrop for the mobile drawer */}
        {collapsed && mobileNavOpen && (
          <div
            className="absolute inset-0 bg-black/40 z-10"
            onClick={() => setMobileNavOpen(false)}
          />
        )}

        <main className="flex-1 min-w-0 overflow-y-auto">
          {tab === 'dashboard' && <DashboardPage />}
          {tab === 'tenants' && <TenantsPage />}
          {tab === 'staff' && <StaffPage />}
          {tab === 'endpoints' && <EndpointsPage />}
          {tab === 'settings' && <SettingsPage />}
        </main>
      </div>
    </div>
  );
}
