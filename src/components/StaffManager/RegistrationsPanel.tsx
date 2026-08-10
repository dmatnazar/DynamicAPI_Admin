import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, UserPlus, Check, X, Pencil } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  fetchPendingRegistrations,
  resolveRegistrationOnVps,
  updateRegistrationOnVps,
} from '../../lib/api';
import { useTenantStore } from '../../store/useTenantStore';
import { useStaffStore } from '../../store/useStaffStore';
import type { StaffMember } from '../../types/staff.types';
import uuid from '../../lib/uuid';

interface PendingReg {
  id: string;
  tenantSlug: string;
  tenantName: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  username: string;
  requestedRole?: string;
  createdAt: string;
  deliveredAt?: string;
}

export function RegistrationsPanel() {
  const tenants = useTenantStore((s) => s.tenants);
  const addStaff = useStaffStore((s) => s.addStaff);
  const [items, setItems] = useState<PendingReg[]>([]);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [gatewayUrl, setGatewayUrl] = useState('');
  const [adminSecret, setAdminSecret] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    username: '',
    requestedRole: 'viewer',
  });

  useEffect(() => {
    void (async () => {
      const url = await window.vaultAPI?.get?.('gatewayUrl');
      if (url) setGatewayUrl(url);
      const secret = await window.vaultAPI?.get?.('adminSyncSecret');
      if (secret) setAdminSecret(secret);
    })();
  }, []);

  const load = useCallback(async () => {
    if (!gatewayUrl || !adminSecret || tenants.length === 0) return;
    setLoading(true);
    setError('');
    try {
      const all: PendingReg[] = [];
      for (const t of tenants) {
        try {
          const list = await fetchPendingRegistrations(gatewayUrl, adminSecret, t.slug);
          all.push(...list);
        } catch {
          /* ignore per-tenant */
        }
      }
      setItems(all);
    } catch (e: any) {
      setError(e?.message || 'Ýüklemek şowsuz');
    } finally {
      setLoading(false);
    }
  }, [gatewayUrl, adminSecret, tenants]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 5000);
    return () => clearInterval(id);
  }, [load]);

  function startEdit(r: PendingReg) {
    setEditId(r.id);
    setEditForm({
      firstName: r.firstName,
      lastName: r.lastName,
      phone: r.phone || '',
      email: r.email || '',
      username: r.username,
      requestedRole: r.requestedRole || 'viewer',
    });
  }

  async function saveEdit() {
    if (!editId || !gatewayUrl || !adminSecret) return;
    setActing(editId);
    try {
      await updateRegistrationOnVps(gatewayUrl, adminSecret, {
        id: editId,
        ...editForm,
      });
      setEditId(null);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Saklamak şowsuz');
    } finally {
      setActing(null);
    }
  }

  async function resolve(reg: PendingReg, action: 'approve' | 'reject') {
    if (!gatewayUrl || !adminSecret) return;
    setActing(reg.id);
    try {
      const payload: any = {
        id: reg.id,
        action,
        role: (editId === reg.id ? editForm.requestedRole : reg.requestedRole) || 'viewer',
        reviewedBy: 'electron-admin',
      };
      if (editId === reg.id) {
        payload.firstName = editForm.firstName;
        payload.lastName = editForm.lastName;
        payload.phone = editForm.phone;
        payload.email = editForm.email;
      }
      const result = await resolveRegistrationOnVps(gatewayUrl, adminSecret, payload);

      if (action === 'approve') {
        const src = editId === reg.id ? editForm : reg;
        const tenant = tenants.find((t) => t.slug === reg.tenantSlug);
        const remote = result?.staff;
        const member: StaffMember = {
          id: remote?.id || uuid.uuid(),
          fullName: remote?.fullName || `${src.firstName} ${src.lastName}`.trim(),
          username: remote?.username || (('username' in src ? src.username : reg.username) as string),
          // Keep real hash from VPS (bcrypt from BI) — never placeholder
          passwordHash: remote?.passwordHash || 'synced-from-bi:keep',
          role: (remote?.role ||
            (editId === reg.id ? editForm.requestedRole : reg.requestedRole) ||
            'viewer') as any,
          tenantIds: tenant ? [tenant.id] : [],
          active: true,
          phone: remote?.phone || src.phone,
          email: remote?.email || src.email,
          createdAt: new Date().toISOString(),
        };
        // Use store set without full gateway replace of other users — addStaff still syncs
        // but pushStaff filters placeholders; real bcrypt hash is fine for VPS merge
        addStaff(member);
      }
      setEditId(null);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Amal şowsuz');
    } finally {
      setActing(null);
    }
  }

  if (!gatewayUrl) {
    return (
      <div className="rounded-xl border border-surface-border bg-surface-raised p-4 text-sm text-neutral-400">
        Gateway URL Settings-de görkezilmedik — BI hasaba alyş islegleri görünmez.
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-surface-border bg-surface-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-indigo-400" />
          <h3 className="text-sm font-semibold text-neutral-100">BI hasaba alyş islegleri</h3>
          {items.length > 0 && <Badge status="testing" label={String(items.length)} />}
        </div>
        <Button variant="ghost" size="sm" onClick={() => load()} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {error && <p className="text-xs text-rose-400">{error}</p>}

      {items.length === 0 ? (
        <p className="text-xs text-neutral-500">Garaşylýan isleg ýok</p>
      ) : (
        <div className="space-y-3">
          {items.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-surface-border bg-surface p-3 space-y-3"
            >
              {editId === r.id ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    className="bg-surface-raised border border-surface-border rounded-md px-2 py-1.5 text-sm"
                    value={editForm.firstName}
                    onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))}
                    placeholder="Ady"
                  />
                  <input
                    className="bg-surface-raised border border-surface-border rounded-md px-2 py-1.5 text-sm"
                    value={editForm.lastName}
                    onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))}
                    placeholder="Familiýa"
                  />
                  <input
                    className="bg-surface-raised border border-surface-border rounded-md px-2 py-1.5 text-sm"
                    value={editForm.phone}
                    onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="+993..."
                  />
                  <input
                    className="bg-surface-raised border border-surface-border rounded-md px-2 py-1.5 text-sm"
                    value={editForm.email}
                    onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="email"
                  />
                  <input
                    className="bg-surface-raised border border-surface-border rounded-md px-2 py-1.5 text-sm"
                    value={editForm.username}
                    onChange={(e) => setEditForm((f) => ({ ...f, username: e.target.value }))}
                    placeholder="login"
                  />
                  <select
                    className="bg-surface-raised border border-surface-border rounded-md px-2 py-1.5 text-sm"
                    value={editForm.requestedRole}
                    onChange={(e) => setEditForm((f) => ({ ...f, requestedRole: e.target.value }))}
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                    <option value="admin">Admin</option>
                  </select>
                  <div className="sm:col-span-2 flex gap-2">
                    <Button size="sm" onClick={saveEdit} disabled={acting === r.id}>
                      Üýtgetmeleri sakla
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>
                      Ýatyr
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-start gap-3 justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-neutral-100">
                      {r.firstName} {r.lastName}{' '}
                      <span className="text-neutral-500">@{r.username}</span>
                    </p>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {r.tenantName} · {r.email} · {r.phone}
                    </p>
                    <p className="text-[11px] text-neutral-600 mt-0.5">
                      Rol: {r.requestedRole || 'viewer'}
                      {r.deliveredAt ? ' · Electron-a ýetdi' : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => startEdit(r)}>
                      <Pencil className="h-3.5 w-3.5" />
                      Üýtget
                    </Button>
                    <Button size="sm" onClick={() => resolve(r, 'approve')} disabled={acting === r.id}>
                      <Check className="h-3.5 w-3.5" />
                      Tassykla
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => resolve(r, 'reject')}
                      disabled={acting === r.id}
                    >
                      <X className="h-3.5 w-3.5" />
                      Ret
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
