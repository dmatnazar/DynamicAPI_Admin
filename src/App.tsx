import { useEffect, useState, useMemo } from 'react';
import {
  LayoutDashboard,
  Building2,
  Users,
  Network,
  Settings as SettingsIcon,
  Menu as MenuIcon,
  LogOut,
  UserCircle,
  Shield,
  Eye,
  Edit3,
  Server,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { TitleBar } from './components/TitleBar';
import { UpdateModal } from './components/UpdateModal';
import { DashboardPage } from './pages/Dashboard';
import { TenantsPage } from './pages/Tenants';
import { StaffPage } from './pages/Staff';
import { EndpointsPage } from './pages/Endpoints';
import { SettingsPage } from './pages/Settings';
import { DeviceGate } from './components/DeviceGate';
import { StartupLogin } from './components/Auth/StartupLogin';
import { CompanyGate } from './components/CompanyGate';
import { useAuthStore } from './store/useAuthStore';
import { useDeviceStore } from './store/useDeviceStore';
import { hydrateStoresFromLocalDb } from './lib/hydrateStores';
import { startAutoSync, subscribeSyncStatus, isDeviceAssignmentReady, getDeviceAssignedSlugs } from './lib/syncEngine';
import { useTenantStore } from './store/useTenantStore';
import { ConfirmDialogHost } from './components/ui/ConfirmDialog';
import { ToastHost } from './components/ui/Toast';

type Tab = 'dashboard' | 'tenants' | 'staff' | 'endpoints' | 'settings';

const ALL_NAV: {
  id: Tab;
  label: string;
  icon: typeof LayoutDashboard;
  allowedRoles: ('admin' | 'editor' | 'manager' | 'viewer')[];
}[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, allowedRoles: ['admin', 'editor', 'manager', 'viewer'] },
  { id: 'tenants', label: 'Companies', icon: Building2, allowedRoles: ['admin', 'editor', 'manager'] },
  { id: 'staff', label: 'Işgärler', icon: Users, allowedRoles: ['admin', 'manager'] },
  { id: 'endpoints', label: 'API Builder', icon: Network, allowedRoles: ['admin', 'editor', 'manager'] },
  { id: 'settings', label: 'Settings', icon: SettingsIcon, allowedRoles: ['admin'] },
];

const COLLAPSE_BREAKPOINT = 860;

export default function App() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const { profile, checkPermission, subscribeToDeviceStatus } = useDeviceStore();
  const { tenants, activeTenantId } = useTenantStore();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [collapsed, setCollapsed] = useState(window.innerWidth < COLLAPSE_BREAKPOINT);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [syncStarted, setSyncStarted] = useState(false);
  const [sidebarGatewayUrl, setSidebarGatewayUrl] = useState('');
  const [sidebarGatewayHealth, setSidebarGatewayHealth] = useState<'unknown' | 'online' | 'offline'>('unknown');

  useEffect(() => {
    void (async () => {
      await hydrateStoresFromLocalDb();

      // Auto-login on startup if enabled
      try {
        const autoLoginEnabled = await window.vaultAPI?.get('autoLoginEnabled');
        if (autoLoginEnabled !== '1') return;
        const username = await window.vaultAPI?.get('autoLoginUsername');
        const password = await window.vaultAPI?.get('autoLoginPassword');
        if (!username || !password) return;

        if ((window as any).authAPI?.loginStaff) {
          const res = await (window as any).authAPI.loginStaff({
            username,
            password,
          });
          if (res.ok && res.user) {
            useAuthStore.getState().login(res.user);
          }
        }
      } catch {
        /* ignore auto-login failures */
      }
    })();
  }, []);

  // Load sidebar gateway info
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const url = await window.vaultAPI?.get?.('gatewayUrl');
        if (cancelled) return;
        if (url) {
          setSidebarGatewayUrl(url);
          try {
            const res = await fetch(`${url}/health`);
            setSidebarGatewayHealth(res.ok ? 'online' : 'offline');
          } catch {
            setSidebarGatewayHealth('offline');
          }
        }
      } catch {
        /* ignore */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const deviceCompanyId = useMemo(() => {
    const slugs = profile?.companySlugs || profile?.tenantSlugs || [];
    for (const slug of slugs) {
      const t = useTenantStore.getState().tenants.find((x) => x.slug === slug);
      if (t) return t.id;
    }
    return null;
  }, [profile?.companySlugs, profile?.tenantSlugs]);

  const isNewCompany = useMemo(() => {
    if (profile?.status !== 'approved') return false;
    const slugs = profile?.companySlugs || profile?.tenantSlugs || [];
    if (slugs.length === 0) return false;
    return slugs.some((slug) => !tenants.some((t) => t.slug === slug));
  }, [profile?.status, profile?.companySlugs, profile?.tenantSlugs, tenants]);

  const deviceAssignedSlugs = useMemo(() => getDeviceAssignedSlugs(), [profile?.companySlugs, profile?.tenantSlugs]);

  const needsCompanyGate = useMemo(() => {
    if (profile?.status === 'approved' && deviceAssignedSlugs.length > 0 && isNewCompany) {
      return true;
    }
    return false;
  }, [profile?.status, deviceAssignedSlugs, isNewCompany]);

  // Start auto-sync only after device assignments are confirmed.
  // - If this is an EXISTING company assignment → sync starts immediately (before login).
  // - If it's a NEW company being onboarded → wait until onboarding + login completes.
  useEffect(() => {
    if (syncStarted) return;
    if (!isDeviceAssignmentReady()) return;
    if (isNewCompany && !isAuthenticated) return;

    setSyncStarted(true);
    void startAutoSync();
  }, [profile?.status, profile?.companySlugs, profile?.tenantSlugs, syncStarted, isNewCompany, isAuthenticated]);

  // Background device permission polling — 5min when authenticated + approved
  useEffect(() => {
    if (!isAuthenticated || !profile || profile.status !== 'approved') return;

    let timer: ReturnType<typeof setInterval> | null = null;
    let backoff = 300000;
    const check = async () => {
      try {
        await checkPermission();
        backoff = 300000;
      } catch (err: any) {
        const msg = String(err?.message || '');
        if (msg.includes('429') || msg.includes('Rate limit')) {
          backoff = Math.min(backoff * 2, 600000);
        }
      }
    };

    timer = setInterval(check, backoff);
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isAuthenticated, profile?.status, checkPermission]);

  // Restart permission polling when store notifies of a status change
  useEffect(() => {
    return subscribeToDeviceStatus(() => {
      const currentStatus = useDeviceStore.getState().profile?.status;
      console.log('[App] Device status changed via subscribeToDeviceStatus:', currentStatus);
    });
  }, [subscribeToDeviceStatus]);

  // Filter navigation tabs based on user role
  const allowedNav = useMemo(() => {
    if (!user) return [];
    return ALL_NAV.filter((n) => n.allowedRoles.includes(user.role || 'viewer'));
  }, [user]);

  // Keep tab within permitted list
  useEffect(() => {
    if (allowedNav.length > 0 && !allowedNav.some((n) => n.id === tab)) {
      setTab(allowedNav[0].id);
    }
  }, [allowedNav, tab]);

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
    const unsubStore = useTenantStore.subscribe(() => {});
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
    setTab(id);
    setMobileNavOpen(false);
  };


  const renderContent = () => {
    console.log('[App] renderContent', { isAuthenticated, user: user?.username, profileStatus: profile?.status, needsCompanyGate });
    if (needsCompanyGate) {
      const gateUser = user || {
        id: 'onboarding-user',
        username: 'onboarding',
        fullName: 'Onboarding',
        role: 'admin' as const,
      };
      return <CompanyGate user={gateUser} deviceCompanyId={deviceCompanyId} isNewCompany={isNewCompany} />;
    }
    if (!isAuthenticated || !user) {
      return (
        <div className="flex flex-col h-screen bg-surface text-neutral-100 overflow-hidden">
          <TitleBar />
          <StartupLogin />
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
            {/* App Brand Header */}
            <div className="h-12 flex items-center justify-between px-3 border-b border-surface-border/50">
              {(!collapsed || mobileNavOpen) && (
                <div className="min-w-0">
                  <h1 className="text-xs font-bold tracking-tight truncate">BI Platform Client</h1>
                  {profile?.companyName && (
                    <p className="text-[10px] text-primary-400 truncate">{profile.companyName}</p>
                  )}
                </div>
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

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {allowedNav.map(({ id, label, icon: Icon, allowedRoles }) => {
                const active = tab === id;
                return (
                  <button
                    key={id}
                    onClick={() => selectTab(id)}
                    title={label}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition ${
                      collapsed && !mobileNavOpen ? 'justify-center px-0' : ''
                    } ${
                      active
                        ? 'bg-primary-600/20 text-primary-300 font-medium border border-primary-500/30'
                        : 'text-neutral-400 hover:bg-surface-card/60 hover:text-neutral-200'
                    }`}
                  >
                    <Icon size={16} className="shrink-0" />
                    {(!collapsed || mobileNavOpen) && (
                      <span className="truncate flex-1 text-left">{label}</span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* VPS Gateway Info */}
            {(!collapsed || mobileNavOpen) && sidebarGatewayUrl && (
              <div className="px-3 py-2 border-t border-surface-border/60">
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-surface-raised border border-surface-border">
                  <Server size={13} className="text-indigo-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-medium text-neutral-400 truncate">VPS Gateway</p>
                    <p className="text-[11px] font-mono text-neutral-200 truncate" title={sidebarGatewayUrl}>
                      {sidebarGatewayUrl}
                    </p>
                  </div>
                  <span className={`shrink-0 h-2 w-2 rounded-full ${
                    sidebarGatewayHealth === 'online' ? 'bg-emerald-400' : sidebarGatewayHealth === 'offline' ? 'bg-rose-400' : 'bg-slate-500'
                  }`} title={sidebarGatewayHealth === 'online' ? 'Online' : sidebarGatewayHealth === 'offline' ? 'Offline' : '...'} />
                </div>
              </div>
            )}

            {/* User Profile & Logout Box */}
            <div className="p-2 border-t border-surface-border/60 bg-surface-card/40 space-y-1">
              {(!collapsed || mobileNavOpen) ? (
                <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-surface-raised border border-surface-border">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-white truncate flex items-center gap-1">
                      <UserCircle size={13} className="text-primary-400 shrink-0" />
                      {user.fullName || user.username}
                    </p>
                    <div className="text-[10px] text-neutral-400 flex items-center gap-1 mt-0.5">
                      {user.role === 'admin' ? (
                        <span className="inline-flex items-center gap-0.5 text-amber-400 font-medium">
                          <Shield size={10} /> Admin
                        </span>
                      ) : user.role === 'manager' ? (
                        <span className="inline-flex items-center gap-0.5 text-purple-400 font-medium">
                          <Shield size={10} /> Manager
                        </span>
                      ) : user.role === 'editor' ? (
                        <span className="inline-flex items-center gap-0.5 text-blue-400 font-medium">
                          <Edit3 size={10} /> Redaktor
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-slate-400 font-medium">
                          <Eye size={10} /> Gözegçi
                        </span>
                      )}
                      <span>•</span>
                      <span className="truncate">@{user.username}</span>
                    </div>
                  </div>

                  <button
                    onClick={logout}
                    className="p-1.5 rounded-lg hover:bg-rose-950/40 text-neutral-400 hover:text-rose-400 transition-colors"
                    title="Ulgamdan çykmak"
                  >
                    <LogOut size={14} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={logout}
                  className="w-full flex justify-center py-2 text-neutral-400 hover:text-rose-400"
                  title="Ulgamdan çykmak"
                >
                  <LogOut size={16} />
                </button>
              )}
            </div>
          </aside>

          {collapsed && mobileNavOpen && (
            <div
              className="absolute inset-0 bg-black/40 z-10"
              onClick={() => setMobileNavOpen(false)}
            />
          )}

          <main className="flex-1 min-w-0 overflow-y-auto">
            {tab === 'dashboard' && <DashboardPage />}
            {tab === 'tenants' && user.role !== 'viewer' && <TenantsPage />}
            {tab === 'staff' && (user.role === 'admin' || user.role === 'manager') && <StaffPage />}
            {tab === 'endpoints' && user.role !== 'viewer' && <EndpointsPage />}
            {tab === 'settings' && user.role === 'admin' && <SettingsPage />}
          </main>
        </div>
      </div>
    );
  };

  return (
    <DeviceGate>
      {renderContent()}
    </DeviceGate>
  );
}
