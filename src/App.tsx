import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Building2,
  Users,
  Network,
  Settings as SettingsIcon,
  Menu as MenuIcon,
  Lock,
} from 'lucide-react';
import { TitleBar } from './components/TitleBar';
import { UpdateModal } from './components/UpdateModal';
import { DashboardPage } from './pages/Dashboard';
import { TenantsPage } from './pages/Tenants';
import { StaffPage } from './pages/Staff';
import { EndpointsPage } from './pages/Endpoints';
import { SettingsPage } from './pages/Settings';
import { UnlockGate } from './components/Auth/UnlockGate';
import { hydrateStoresFromLocalDb } from './lib/hydrateStores';
import { startAutoSync, subscribeSyncStatus } from './lib/syncEngine';
import { useTenantStore } from './store/useTenantStore';
import { ConfirmDialogHost } from './components/ui/ConfirmDialog';
import { ToastHost } from './components/ui/Toast';

type Tab = 'dashboard' | 'tenants' | 'staff' | 'endpoints' | 'settings';

const NAV: { id: Tab; label: string; icon: typeof LayoutDashboard; requiresUnlock?: boolean }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'tenants', label: 'Companies', icon: Building2, requiresUnlock: true },
  { id: 'staff', label: 'Işgärler', icon: Users, requiresUnlock: true },
  { id: 'endpoints', label: 'API Builder', icon: Network, requiresUnlock: true },
  { id: 'settings', label: 'Settings', icon: SettingsIcon, requiresUnlock: true },
];

const COLLAPSE_BREAKPOINT = 860;

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [collapsed, setCollapsed] = useState(window.innerWidth < COLLAPSE_BREAKPOINT);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // null = still checking; true = full access; false = dashboard only
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [hasPassword, setHasPassword] = useState(false);
  const [showGate, setShowGate] = useState(true);

  useEffect(() => {
    void (async () => {
      const has = await window.appLockAPI?.hasPassword?.().catch(() => false);
      setHasPassword(!!has);
      if (!has) {
        // no password configured → full access
        setUnlocked(true);
        setShowGate(false);
      } else {
        setUnlocked(null);
        setShowGate(true);
      }
      await hydrateStoresFromLocalDb();
      startAutoSync();
    })();
  }, []);

  // Push tray icon status from VPS online + any successful DB connection
  useEffect(() => {
    const pushTray = (online: boolean | null | undefined) => {
      const tenants = useTenantStore.getState().tenants || [];
      const anyDbOk = tenants.some(
        (t) =>
          t.connectionStatus === 'success' ||
          t.connections?.some((c) => c.connectionStatus === 'success')
      );
      let status: 'ok' | 'partial' | 'offline' = 'offline';
      if (online === true && anyDbOk) status = 'ok';
      else if (online === true || anyDbOk) status = 'partial';
      else status = 'offline';
      void window.trayAPI?.setStatus?.(status);
    };

    const unsub = subscribeSyncStatus((s) => pushTray(s.online));
    const unsubStore = useTenantStore.subscribe(() => {
      // re-evaluate when tenants change
      // online unknown here — tray will refresh on next sync tick too
    });
    return () => {
      unsub();
      unsubStore();
    };
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
    const item = NAV.find((n) => n.id === id);
    if (item?.requiresUnlock && unlocked !== true) {
      setShowGate(true);
      return;
    }
    setTab(id);
    setMobileNavOpen(false);
  };

  if (showGate && unlocked !== true) {
    return (
      <div className="flex flex-col h-screen bg-surface text-neutral-100 overflow-hidden">
        <TitleBar />
        <UnlockGate
          hasPassword={hasPassword}
          onUnlocked={() => {
            setUnlocked(true);
            setShowGate(false);
          }}
          onContinueLocked={() => {
            setUnlocked(false);
            setShowGate(false);
            setTab('dashboard');
          }}
        />
        <ToastHost />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-surface text-neutral-100 overflow-hidden">
      <TitleBar />
      <UpdateModal />
      <ConfirmDialogHost />
      <ToastHost />

      <div className="flex flex-1 min-h-0 overflow-hidden relative">
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
            {NAV.map(({ id, label, icon: Icon, requiresUnlock }) => {
              const locked = requiresUnlock && unlocked !== true;
              return (
                <button
                  key={id}
                  onClick={() => selectTab(id)}
                  title={locked ? `${label} (parol gerek)` : label}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition ${
                    collapsed && !mobileNavOpen ? 'justify-center px-0' : ''
                  } ${
                    tab === id
                      ? 'bg-surface-card text-neutral-100'
                      : locked
                        ? 'text-neutral-600 cursor-not-allowed'
                        : 'text-neutral-400 hover:bg-surface-card/60 hover:text-neutral-200'
                  }`}
                >
                  <Icon size={16} className="shrink-0" />
                  {(!collapsed || mobileNavOpen) && (
                    <span className="truncate flex-1 text-left">{label}</span>
                  )}
                  {locked && (!collapsed || mobileNavOpen) && (
                    <Lock size={12} className="shrink-0 text-neutral-600" />
                  )}
                </button>
              );
            })}
          </nav>
          {unlocked !== true && (!collapsed || mobileNavOpen) && (
            <div className="p-2 border-t border-surface-border">
              <button
                onClick={() => setShowGate(true)}
                className="w-full text-xs text-indigo-400 hover:text-indigo-300 py-2"
              >
                Parol bilen aç
              </button>
            </div>
          )}
        </aside>

        {collapsed && mobileNavOpen && (
          <div
            className="absolute inset-0 bg-black/40 z-10"
            onClick={() => setMobileNavOpen(false)}
          />
        )}

        <main className="flex-1 min-w-0 overflow-y-auto">
          {tab === 'dashboard' && <DashboardPage />}
          {tab === 'tenants' && unlocked === true && <TenantsPage />}
          {tab === 'staff' && unlocked === true && <StaffPage />}
          {tab === 'endpoints' && unlocked === true && <EndpointsPage />}
          {tab === 'settings' && unlocked === true && <SettingsPage />}
        </main>
      </div>
    </div>
  );
}
