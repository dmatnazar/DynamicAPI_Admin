import { useState } from 'react';
import { Building2, MapPin, Phone, Mail, User, Pencil, Power, PowerOff } from 'lucide-react';
import type { TenantConfig, TenantConnection } from '../../types/endpoint.types';
import { useEndpointStore } from '../../store/useEndpointStore';
import { useStaffStore } from '../../store/useStaffStore';
import { useTenantStore } from '../../store/useTenantStore';
import { ConnectionList } from './ConnectionList';
import { ConnectionFormModal } from './ConnectionFormModal';
import { Button } from '../ui/Button';
import { toastWarning, toastError, toastSuccess } from '../ui/Toast';
import { confirmDialog } from '../ui/ConfirmDialog';
import uuid from '../../lib/uuid';
import { buildMssqlConnectionString } from '../../types/endpoint.types';

interface Props {
  tenant: TenantConfig;
  onEditCompany?: () => void;
}

export function TenantConnectionsPanel({ tenant, onEditCompany }: Props) {
  const { addConnection, updateConnection, removeConnection, setPrimaryConnection, removeTenant, toggleTenantActive } =
    useTenantStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TenantConnection | null>(null);

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (conn: TenantConnection) => {
    setEditing(conn);
    setModalOpen(true);
  };

  const handleSave = (data: TenantConnection) => {
    if (editing) {
      updateConnection(tenant.id, editing.id, {
        ...data,
        id: editing.id,
        isPrimary: editing.isPrimary,
        connectionString: data.connectionString || buildMssqlConnectionString(data),
      });
    } else {
      const hasPrimary = tenant.connections.some((c) => c.isPrimary);
      addConnection(tenant.id, {
        ...data,
        isPrimary: !hasPrimary || data.isPrimary,
        connectionStatus: data.connectionStatus || 'success',
        connectionString: data.connectionString || buildMssqlConnectionString(data),
      });
    }
  };

  const handleTest = async (conn: TenantConnection) => {
    try {
      if (!window.mssqlAPI) {
        updateConnection(tenant.id, conn.id, { connectionStatus: 'failed' });
        return false;
      }
      const res = await window.mssqlAPI.testConnection({
        host: conn.host,
        port: conn.port,
        database: conn.database || 'master',
        username: conn.username,
        password: conn.password,
        encrypt: conn.encrypt !== false,
        trustServerCertificate: conn.trustServerCertificate !== false,
      });
      updateConnection(tenant.id, conn.id, {
        connectionStatus: res.ok ? 'success' : 'failed',
      });
      return res.ok;
    } catch {
      updateConnection(tenant.id, conn.id, { connectionStatus: 'failed' });
      return false;
    }
  };

  const handleDeleteCompany = async () => {
    const endpoints = useEndpointStore.getState().endpointsByTenant[tenant.id] || [];
    const staff = useStaffStore.getState().staff.filter((s) =>
      (s.tenantIds || []).includes(tenant.id)
    );
    if (endpoints.length > 0 || staff.length > 0) {
      toastWarning(
        'Pozup bolmaýar',
        `Bagly: ${staff.length} işgär, ${endpoints.length} API. Ilki olary aýyryň.`
      );
      return;
    }
    const ok = await confirmDialog({
      title: 'Kompaniýany poz',
      message: `«${tenant.name}» kompaniýasyny doly pozmak isleýärsiňizmi?\n\nBagly API / işgär ýok. Bu hereketi yzyna almak mümkin däl.`,
      confirmLabel: 'Poz',
      danger: true,
    });
    if (ok) {
      removeTenant(tenant.id);
      toastSuccess('Kompaniýa pozuldy', 'VPS bilen sync');
    }
  };

  const handleDeleteConn = async (c: TenantConnection) => {
    const ok = await confirmDialog({
      title: 'Baglanyşygy poz',
      message: `«${c.label}» (${c.host}/${c.database}) baglanyşygyny pozmalymy?`,
      confirmLabel: 'Poz',
      danger: true,
    });
    if (ok) removeConnection(tenant.id, c.id);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-surface-border bg-surface-card p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Building2 size={16} className={tenant.isActive === false ? 'text-neutral-500' : 'text-blue-400 shrink-0'} />
              <h2
                className={`text-base font-semibold truncate ${
                  tenant.isActive === false ? 'text-neutral-400' : 'text-neutral-100'
                }`}
              >
                {tenant.name}
              </h2>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                  tenant.isActive === false
                    ? 'bg-neutral-700/60 text-neutral-400'
                    : 'bg-emerald-500/15 text-emerald-400'
                }`}
              >
                {tenant.isActive === false ? 'Passiw' : 'Aktiw'}
              </span>
            </div>
            <p className="text-xs font-mono text-neutral-500 mt-0.5">/{tenant.slug}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleTenantActive(tenant.id);
              }}
              className={`p-1 rounded-md transition-colors ${
                tenant.isActive === false
                  ? 'text-neutral-500 hover:text-neutral-300 hover:bg-surface-raised'
                  : 'text-emerald-400 hover:text-emerald-300 hover:bg-surface-raised'
              }`}
              title={tenant.isActive === false ? 'Passiw' : 'Aktiw'}
            >
              {tenant.isActive === false ? <PowerOff size={15} /> : <Power size={15} />}
            </button>
            {onEditCompany && (
              <Button variant="ghost" className="!text-xs" onClick={onEditCompany}>
                <Pencil size={13} className="inline mr-1" />
                Üýtget
              </Button>
            )}
            <Button variant="ghost" className="!text-xs !text-red-400" onClick={() => void handleDeleteCompany()}>
              Poz
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-neutral-400">
          {tenant.legalName && (
            <div>
              <span className="text-neutral-600">Kanuny ady: </span>
              {tenant.legalName}
            </div>
          )}
          {tenant.taxId && (
            <div>
              <span className="text-neutral-600">TIN: </span>
              {tenant.taxId}
            </div>
          )}
          {tenant.industry && (
            <div>
              <span className="text-neutral-600">Ugur: </span>
              {tenant.industry}
            </div>
          )}
          {(tenant.city || tenant.country) && (
            <div className="flex items-center gap-1">
              <MapPin size={11} />
              {[tenant.city, tenant.country].filter(Boolean).join(', ')}
            </div>
          )}
          {tenant.address && (
            <div className="sm:col-span-2">
              <span className="text-neutral-600">Salgy: </span>
              {tenant.address}
            </div>
          )}
          {tenant.phone && (
            <div className="flex items-center gap-1">
              <Phone size={11} />
              {tenant.phone}
            </div>
          )}
          {tenant.email && (
            <div className="flex items-center gap-1">
              <Mail size={11} />
              {tenant.email}
            </div>
          )}
          {tenant.contactPerson && (
            <div className="flex items-center gap-1 sm:col-span-2">
              <User size={11} />
              {tenant.contactPerson}
              {tenant.contactPhone ? ` · ${tenant.contactPhone}` : ''}
              {tenant.contactEmail ? ` · ${tenant.contactEmail}` : ''}
            </div>
          )}
          {tenant.notes && <div className="sm:col-span-2 text-neutral-500 italic">{tenant.notes}</div>}
        </div>
      </div>

      <div className="rounded-xl border border-surface-border bg-surface-card p-4">
        <ConnectionList
          connections={tenant.connections}
          onAdd={openAdd}
          onEdit={openEdit}
          onDelete={(c) => void handleDeleteConn(c)}
          onSetPrimary={(c) => setPrimaryConnection(tenant.id, c.id)}
          onTest={handleTest}
        />
      </div>

      <ConnectionFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initial={editing}
        onSave={handleSave}
      />
    </div>
  );
}
