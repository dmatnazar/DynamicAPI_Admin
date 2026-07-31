import { useState } from 'react';
import { Building2, MapPin, Pencil, Phone, Plus, Trash2 } from 'lucide-react';
import { useTenantStore } from '../store/useTenantStore';
import { TenantList } from '../components/TenantManager/TenantList';
import { CompanyFormModal, type CompanyFormValues } from '../components/TenantManager/CompanyFormModal';
import {
  ConnectionFormModal,
  type ConnectionFormValues,
} from '../components/TenantManager/ConnectionFormModal';
import { ConnectionList } from '../components/TenantManager/ConnectionList';
import { Button } from '../components/ui/Button';
import uuid from '../lib/uuid';
import type { DbConnection } from '../types/endpoint.types';

export function TenantsPage() {
  const {
    tenants,
    activeTenantId,
    addTenant,
    updateTenant,
    removeTenant,
    setActiveTenant,
    addConnection,
    updateConnection,
    removeConnection,
    setActiveConnection,
  } = useTenantStore();

  const activeTenant = tenants.find((t) => t.id === activeTenantId) ?? null;

  const [companyModal, setCompanyModal] = useState<'create' | 'edit' | null>(null);
  const [connectionModal, setConnectionModal] = useState<
    { mode: 'create' } | { mode: 'edit'; conn: DbConnection } | null
  >(null);

  const submitCompany = (values: CompanyFormValues, slug?: string) => {
    if (companyModal === 'create') {
      addTenant({
        id: uuid.uuid(),
        slug: slug || uuid.uuid().slice(0, 8),
        connections: [],
        activeConnectionId: null,
        ...values,
      });
    } else if (activeTenant) {
      updateTenant(activeTenant.id, values);
    }
    setCompanyModal(null);
  };

  const deleteCompany = () => {
    if (!activeTenant) return;
    if (!window.confirm(`"${activeTenant.name}" kompaniýasyny pozmakçymy? Bu ähli connection-lary hem pozar.`))
      return;
    removeTenant(activeTenant.id);
  };

  const submitConnection = (values: ConnectionFormValues) => {
    if (!activeTenant || !connectionModal) return;
    if (connectionModal.mode === 'create') {
      addConnection(activeTenant.id, { id: uuid.uuid(), status: 'unknown', ...values });
    } else {
      updateConnection(activeTenant.id, connectionModal.conn.id, values);
    }
    setConnectionModal(null);
  };

  const deleteConnection = (conn: DbConnection) => {
    if (!activeTenant) return;
    if (!window.confirm(`"${conn.connectionName}" connection-yny pozmakçymy?`)) return;
    removeConnection(activeTenant.id, conn.id);
  };

  // Stub: a real implementation calls an Electron IPC handler in the main
  // process that opens a short-lived mssql.ConnectionPool and reports back.
  // Wired here so the UI/UX is final; only the main-process handler is
  // still a TODO (needs the `mssql` package added to electron/, not renderer).
  const testConnection = async (conn: DbConnection): Promise<boolean> => {
    if (!activeTenant) return false;
    updateConnection(activeTenant.id, conn.id, { status: 'testing' });
    await new Promise((r) => setTimeout(r, 900));
    const ok = conn.host.trim().length > 0 && conn.database.trim().length > 0;
    updateConnection(activeTenant.id, conn.id, { status: ok ? 'success' : 'failed' });
    return ok;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-4 sm:p-6">
      <div className="lg:col-span-1 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-100">Companies</h2>
          <Button variant="ghost" className="!px-2.5 !py-1.5 !text-xs" onClick={() => setCompanyModal('create')}>
            <Plus size={14} className="inline -mt-0.5 mr-1" />
            Täze kompaniýa
          </Button>
        </div>
        <TenantList tenants={tenants} activeId={activeTenantId} onSelect={setActiveTenant} />
      </div>

      <div className="lg:col-span-2 space-y-4">
        {!activeTenant ? (
          <p className="text-sm text-neutral-500">Çepden bir kompaniýa saýla, ýa-da täzesini goş.</p>
        ) : (
          <>
            <div className="rounded-xl border border-surface-border bg-surface-card p-4 sm:p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Building2 size={18} className="text-accent shrink-0" />
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-neutral-100 truncate">{activeTenant.name}</h3>
                    {activeTenant.fullName && (
                      <p className="text-xs text-neutral-500 truncate">{activeTenant.fullName}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="ghost" className="!px-2.5 !py-1.5 !text-xs" onClick={() => setCompanyModal('edit')}>
                    <Pencil size={13} className="inline -mt-0.5 mr-1" />
                    Üýtget
                  </Button>
                  <Button
                    variant="ghost"
                    className="!px-2.5 !py-1.5 !text-xs !text-red-400"
                    onClick={deleteCompany}
                  >
                    <Trash2 size={13} className="inline -mt-0.5 mr-1" />
                    Poz
                  </Button>
                </div>
              </div>

              {(activeTenant.phones.length > 0 || activeTenant.address) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-surface-border/60">
                  {activeTenant.phones.length > 0 && (
                    <div className="flex items-start gap-1.5 pt-2">
                      <Phone size={13} className="text-neutral-500 mt-0.5 shrink-0" />
                      <p className="text-xs text-neutral-400">{activeTenant.phones.join(', ')}</p>
                    </div>
                  )}
                  {activeTenant.address && (
                    <div className="flex items-start gap-1.5 pt-2">
                      <MapPin size={13} className="text-neutral-500 mt-0.5 shrink-0" />
                      <p className="text-xs text-neutral-400">{activeTenant.address}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <ConnectionList
              connections={activeTenant.connections}
              activeConnectionId={activeTenant.activeConnectionId}
              onAdd={() => setConnectionModal({ mode: 'create' })}
              onEdit={(conn) => setConnectionModal({ mode: 'edit', conn })}
              onDelete={deleteConnection}
              onSetActive={(conn) => setActiveConnection(activeTenant.id, conn.id)}
              onTest={testConnection}
            />
          </>
        )}
      </div>

      {companyModal && (
        <CompanyFormModal
          mode={companyModal}
          initial={companyModal === 'edit' ? activeTenant ?? undefined : undefined}
          onClose={() => setCompanyModal(null)}
          onSubmit={submitCompany}
        />
      )}

      {connectionModal && (
        <ConnectionFormModal
          mode={connectionModal.mode}
          initial={connectionModal.mode === 'edit' ? connectionModal.conn : undefined}
          onClose={() => setConnectionModal(null)}
          onSubmit={submitConnection}
        />
      )}
    </div>
  );
}
