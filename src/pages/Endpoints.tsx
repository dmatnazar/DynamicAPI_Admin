import { useEffect, useMemo, useState, useRef } from 'react';
import { Download, Upload, Plus, Trash2, Play, CloudUpload, Copy } from 'lucide-react';
import { useTenantStore } from '../store/useTenantStore';
import { useEndpointStore } from '../store/useEndpointStore';
import { EndpointList } from '../components/ApiBuilder/EndpointList';
import { EndpointEditor } from '../components/ApiBuilder/EndpointEditor';
import { QueryEditorPage } from '../components/ApiBuilder/QueryEditorPage';
import { SyncGatewayModal } from '../components/SyncPanel/SyncGatewayModal';
import { Button } from '../components/ui/Button';
import { confirmDialog, alertDialog } from '../components/ui/ConfirmDialog';
import uuid from '../lib/uuid';
import type { EndpointConfig } from '../types/endpoint.types';
import { getConnectionForEndpoint } from '../types/endpoint.types';
import {
  validatePathTemplate,
  findDuplicateEndpoint,
  exportEndpointsJson,
  importEndpointsJson,
  uniquePath,
} from '../lib/endpointHelpers';
import { checkGatewayHealth } from '../lib/api';

const DEFAULT_GATEWAY_URL = 'http://localhost:4000';

function blankEndpoint(companyId: string, connectionId?: string): EndpointConfig {
  return {
    id: uuid.uuid(),
    name: '',
    method: 'GET',
    pathTemplate: '/test',
    sqlQuery: '-- SELECT ... FROM ... WHERE Id = @id',
    paramsSchema: { urlParams: [], queryParams: [], bodyParams: [] },
    cacheTtlSec: 0,
    authRequired: true,
    companyId,
    connectionId,
  };
}

export function EndpointsPage() {
  const { tenants, activeTenantId, setActiveTenant } = useTenantStore();
  const activeTenant = tenants.find((t) => t.id === activeTenantId) ?? null;

  const {
    endpointsByTenant,
    activeEndpointId,
    addEndpoint,
    updateEndpoint,
    removeEndpoint,
    setActiveEndpoint,
  } = useEndpointStore();

  const [gatewayUrl, setGatewayUrl] = useState(DEFAULT_GATEWAY_URL);
  const [adminSecret, setAdminSecret] = useState('');
  const [queryEditorOpen, setQueryEditorOpen] = useState(false);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [gatewayOk, setGatewayOk] = useState<boolean | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    console.log('[EndpointsPage] mount / hydrate settings');
    window.vaultAPI?.get('gatewayUrl').then((v) => v && setGatewayUrl(v));
    window.vaultAPI?.get('adminSyncSecret').then((v) => v && setAdminSecret(v));
    window.dbAPI?.getSettings().then((s) => {
      if (s?.gatewayUrl) setGatewayUrl(s.gatewayUrl);
      if (s?.adminSecret) setAdminSecret(s.adminSecret);
    });
  }, []);

  useEffect(() => {
    if (!activeTenantId && tenants.length > 0) {
      console.log('[EndpointsPage] auto-select first tenant', tenants[0].id);
      setActiveTenant(tenants[0].id);
    }
  }, [tenants, activeTenantId, setActiveTenant]);

  const endpoints = activeTenantId ? endpointsByTenant[activeTenantId] ?? [] : [];
  const activeEndpoint = endpoints.find((e) => e.id === activeEndpointId) ?? null;

  useEffect(() => {
    console.log('[EndpointsPage] activeEndpoint changed', {
      activeEndpointId,
      hasActive: !!activeEndpoint,
      name: activeEndpoint?.name,
      path: activeEndpoint?.pathTemplate,
    });
    if (!activeEndpoint) setQueryEditorOpen(false);
  }, [activeEndpoint, activeEndpointId]);

  // Ensure connectionId defaults to primary when missing (guard against loops)
  useEffect(() => {
    if (!activeTenant || !activeEndpoint) return;
    if (activeEndpoint.connectionId) return;
    const primary =
      activeTenant.connections.find((c) => c.isPrimary) ?? activeTenant.connections[0];
    if (primary) {
      console.log('[EndpointsPage] auto-set connectionId', {
        endpointId: activeEndpoint.id,
        connectionId: primary.id,
      });
      updateEndpoint(activeTenant.id, activeEndpoint.id, {
        connectionId: primary.id,
        companyId: activeTenant.id,
      });
    }
  }, [activeTenant, activeEndpoint?.id, activeEndpoint?.connectionId, updateEndpoint]);

  const pathError = useMemo(
    () => (activeEndpoint ? validatePathTemplate(activeEndpoint.pathTemplate) : null),
    [activeEndpoint]
  );

  const duplicateError = useMemo(() => {
    if (!activeEndpoint) return null;
    const dup = findDuplicateEndpoint(
      endpoints,
      activeEndpoint.method,
      activeEndpoint.pathTemplate,
      activeEndpoint.id,
      activeEndpoint.connectionId
    );
    return dup
      ? `Gaýtalanma: ${dup.method} ${dup.pathTemplate} («${dup.name}») — path ýa-da method üýtgetiň`
      : null;
  }, [activeEndpoint, endpoints]);

  const handleSelectEndpoint = (id: string) => {
    console.log('[EndpointsPage] select endpoint', id);
    try {
      setActiveEndpoint(id);
    } catch (err) {
      console.error('[EndpointsPage] setActiveEndpoint failed', err);
    }
  };

  const handleAdd = () => {
    console.log('[EndpointsPage] handleAdd clicked', {
      activeTenantId,
      hasTenant: !!activeTenant,
      connections: activeTenant?.connections?.length ?? 0,
    });
    if (!activeTenantId || !activeTenant) return;
    const primary =
      activeTenant.connections.find((c) => c.isPrimary) ?? activeTenant.connections[0];
    if (!primary) {
      void alertDialog({
        title: 'Database gerek',
        message: 'Ilki Companies sahypasynda şu kompaniýa üçin database baglanyşyk goşuň.',
        variant: 'error',
      });
      return;
    }
    try {
      const ep = blankEndpoint(activeTenantId, primary.id);
      console.log('[EndpointsPage] adding blank endpoint', ep);
      addEndpoint(activeTenantId, ep);
    } catch (err) {
      console.error('[EndpointsPage] addEndpoint failed', err);
    }
  };

  const handleDuplicate = () => {
    if (!activeTenantId || !activeEndpoint || !activeTenant) return;
    const newPath = uniquePath(endpoints, activeEndpoint.pathTemplate);
    const copy: EndpointConfig = {
      ...activeEndpoint,
      id: uuid.uuid(),
      name: activeEndpoint.name ? `${activeEndpoint.name}-copy` : 'copy',
      pathTemplate: newPath,
      companyId: activeTenant.id,
      connectionId:
        activeEndpoint.connectionId ||
        activeTenant.connections.find((c) => c.isPrimary)?.id ||
        activeTenant.connections[0]?.id,
    };
    console.log('[EndpointsPage] duplicate endpoint', copy.id, copy.pathTemplate);
    addEndpoint(activeTenantId, copy);
    void alertDialog({
      title: 'Duplicate döredildi',
      message: `Täze path: ${newPath}\nIki birmeňzeş API bolmaz ýaly path üýtgedildi. Gerek bolsa ýene üýtgediň.`,
      variant: 'success',
    });
  };

  const handleCompanyChange = (newCompanyId: string) => {
    if (!activeEndpoint || !activeTenantId) return;
    const newTenant = tenants.find((t) => t.id === newCompanyId);
    if (!newTenant) return;
    const primary = newTenant.connections.find((c) => c.isPrimary) ?? newTenant.connections[0];

    console.log('[EndpointsPage] move endpoint to company', {
      from: activeTenantId,
      to: newCompanyId,
      endpointId: activeEndpoint.id,
    });

    removeEndpoint(activeTenantId, activeEndpoint.id);
    const moved: EndpointConfig = {
      ...activeEndpoint,
      companyId: newCompanyId,
      connectionId: primary?.id,
    };
    addEndpoint(newCompanyId, moved);
    setActiveTenant(newCompanyId);
  };

  const handleDelete = async () => {
    if (!activeTenantId || !activeEndpoint) return;
    const ok = await confirmDialog({
      title: 'Endpoint poz',
      message: `«${activeEndpoint.name || activeEndpoint.pathTemplate}» endpoint-ini pozmak isleýärsiňizmi?`,
      confirmLabel: 'Poz',
      danger: true,
    });
    if (ok) {
      console.log('[EndpointsPage] delete endpoint', activeEndpoint.id);
      removeEndpoint(activeTenantId, activeEndpoint.id);
      setActiveEndpoint(null);
    }
  };

  const handleExport = () => {
    const json = exportEndpointsJson(endpoints);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeTenant?.slug || 'endpoints'}-api.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (file: File) => {
    try {
      const text = await file.text();
      const items = importEndpointsJson(text);
      if (!activeTenantId || !activeTenant) return;
      const primary =
        activeTenant.connections.find((c) => c.isPrimary) ?? activeTenant.connections[0];
      for (const item of items) {
        addEndpoint(activeTenantId, {
          ...item,
          id: uuid.uuid(),
          companyId: activeTenantId,
          connectionId: (item as EndpointConfig).connectionId || primary?.id,
        });
      }
      await alertDialog({
        title: 'Import üstünlikli',
        message: `${items.length} endpoint goşuldy.`,
        variant: 'success',
      });
    } catch (e) {
      await alertDialog({
        title: 'Import ýalňyşlygy',
        message: (e as Error).message,
        variant: 'error',
      });
    }
  };

  if (!activeTenant) {
    return (
      <div className="p-4 sm:p-6">
        <p className="text-sm text-neutral-500">Ilki Companies tab-dan kompaniýa saýlaň ýa-da dörediň.</p>
      </div>
    );
  }

  if (queryEditorOpen && activeEndpoint) {
    const availableParams = [
      ...(activeEndpoint.paramsSchema?.urlParams ?? []),
      ...(activeEndpoint.paramsSchema?.queryParams ?? []),
      ...(activeEndpoint.paramsSchema?.bodyParams ?? []),
    ];
    const connection = getConnectionForEndpoint(activeTenant, activeEndpoint);
    console.log('[EndpointsPage] open QueryEditor', {
      endpointId: activeEndpoint.id,
      connectionId: connection?.id,
      host: connection?.host,
      database: connection?.database,
    });
    return (
      <QueryEditorPage
        endpoint={activeEndpoint}
        availableParams={availableParams}
        connection={connection}
        onBack={() => setQueryEditorOpen(false)}
        onChange={(patch) => updateEndpoint(activeTenant.id, activeEndpoint.id, patch)}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 sm:p-6 h-full min-h-0">
      <div className="lg:col-span-1 space-y-3 flex flex-col min-h-0">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-neutral-100 truncate">API Builder</h2>
            <p className="text-[11px] text-neutral-500 truncate">
              {activeTenant.name} · /{activeTenant.slug}
            </p>
          </div>
          <Button variant="ghost" className="!px-2 !py-1 !text-xs shrink-0" onClick={handleAdd}>
            <Plus size={13} className="inline mr-0.5" />
            Täze
          </Button>
        </div>

        {tenants.length > 1 && (
          <select
            className="w-full bg-surface-card border border-surface-border rounded-md px-2 py-1.5 text-xs"
            value={activeTenantId ?? ''}
            onChange={(e) => setActiveTenant(e.target.value)}
          >
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} (/{t.slug})
              </option>
            ))}
          </select>
        )}

        <div className="flex-1 overflow-y-auto min-h-0 rounded-lg border border-surface-border/60 p-1">
          <EndpointList
            endpoints={endpoints}
            activeId={activeEndpointId}
            onSelect={handleSelectEndpoint}
            gatewayUrl={gatewayUrl}
            tenant={activeTenant}
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Button variant="ghost" className="!text-[11px] !px-2 !py-1" onClick={handleExport} disabled={!endpoints.length}>
            <Download size={12} className="inline mr-1" />
            Export
          </Button>
          <Button variant="ghost" className="!text-[11px] !px-2 !py-1" onClick={() => fileRef.current?.click()}>
            <Upload size={12} className="inline mr-1" />
            Import
          </Button>
          {/* Sync VPS → TitleBar */}
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleImport(f);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      <div className="lg:col-span-2 space-y-4 min-w-0">
        {activeEndpoint ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-neutral-100">
                {activeEndpoint.name || 'Adsyz endpoint'}
              </h3>
              <div className="flex flex-wrap gap-1.5">
                <Button variant="ghost" className="!text-xs" onClick={handleDuplicate}>
                  <Copy size={12} className="inline mr-1" />
                  Duplicate
                </Button>
                <Button variant="ghost" className="!text-xs" onClick={() => setQueryEditorOpen(true)}>
                  <Play size={12} className="inline mr-1" />
                  Test / Query
                </Button>
                <Button variant="ghost" className="!text-xs !text-red-400" onClick={() => void handleDelete()}>
                  <Trash2 size={12} className="inline mr-1" />
                  Poz
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-surface-border bg-surface-card p-4">
              <EndpointEditor
                endpoint={activeEndpoint}
                pathError={pathError}
                duplicateError={duplicateError}
                tenants={tenants}
                tenant={activeTenant}
                gatewayUrl={gatewayUrl}
                onCompanyChange={handleCompanyChange}
                onChange={(patch) => {
                  console.log('[EndpointsPage] endpoint patch', activeEndpoint.id, Object.keys(patch));
                  updateEndpoint(activeTenant.id, activeEndpoint.id, patch);
                }}
              />
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-surface-border p-10 text-center space-y-3">
            <p className="text-sm text-neutral-400">Endpoint saýlaň ýa-da täze dörediň</p>
            <Button onClick={handleAdd} className="!text-xs">
              <Plus size={13} className="inline mr-1" />
              Täze endpoint
            </Button>
          </div>
        )}

        <div className="rounded-xl border border-surface-border bg-surface-card p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-neutral-400">
              Gateway: <span className="font-mono text-neutral-300">{gatewayUrl}</span>
              {gatewayOk === true && <span className="ml-2 text-emerald-400">● online</span>}
              {gatewayOk === false && <span className="ml-2 text-red-400">● offline</span>}
            </p>
            <div className="flex gap-1.5">
              <Button
                variant="ghost"
                className="!text-[11px] !px-2 !py-1"
                onClick={() => void checkGatewayHealth(gatewayUrl).then(setGatewayOk)}
              >
                Health check
              </Button>
              <Button className="!text-[11px] !px-2.5 !py-1" onClick={() => setSyncModalOpen(true)}>
                <CloudUpload size={12} className="inline mr-1" />
                Sync VPS Gateway
              </Button>
            </div>
          </div>
        </div>
      </div>

      <SyncGatewayModal
        open={syncModalOpen}
        onClose={() => setSyncModalOpen(false)}
        gatewayUrl={gatewayUrl}
        adminSecret={adminSecret}
        tenant={activeTenant}
        endpoints={endpoints}
      />
    </div>
  );
}