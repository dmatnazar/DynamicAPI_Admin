import { useState, useEffect } from 'react';
import { Eye, EyeOff, RefreshCw, Database } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import type { TenantConnection, DbType } from '../../types/endpoint.types';
import { DB_TYPE_OPTIONS, buildMssqlConnectionString } from '../../types/endpoint.types';
import uuid from '../../lib/uuid';

interface Props {
  open: boolean;
  onClose: () => void;
  initial?: TenantConnection | null;
  onSave: (conn: TenantConnection) => void;
}

type TestState = 'idle' | 'testing' | 'success' | 'failed';

export function ConnectionFormModal({ open, onClose, initial, onSave }: Props) {
  const isEdit = !!initial;
  const [label, setLabel] = useState(initial?.label || 'Primary');
  const [dbType, setDbType] = useState<DbType>(initial?.dbType || 'mssql');
  const [host, setHost] = useState(initial?.host || '');
  const [port, setPort] = useState(initial?.port || 1433);
  const [database, setDatabase] = useState(initial?.database || '');
  const [username, setUsername] = useState(initial?.username || '');
  const [password, setPassword] = useState(initial?.password || '');
  const [encrypt, setEncrypt] = useState(initial?.encrypt !== false);
  const [trust, setTrust] = useState(initial?.trustServerCertificate !== false);
  const [showPassword, setShowPassword] = useState(false);
  const [testState, setTestState] = useState<TestState>('idle');
  const [testMsg, setTestMsg] = useState('');
  const [databases, setDatabases] = useState<string[]>([]);
  const [loadingDbs, setLoadingDbs] = useState(false);
  const [dbListError, setDbListError] = useState('');

  // Re-fill form every time modal opens / initial changes (edit mode)
  useEffect(() => {
    if (!open) return;
    setLabel(initial?.label || 'Primary');
    setDbType(initial?.dbType || 'mssql');
    setHost(initial?.host || '');
    setPort(initial?.port || 1433);
    setDatabase(initial?.database || '');
    setUsername(initial?.username || '');
    setPassword(initial?.password || '');
    setEncrypt(initial?.encrypt !== false);
    setTrust(initial?.trustServerCertificate !== false);
    setShowPassword(false);
    setTestState('idle');
    setTestMsg('');
    setDatabases([]);
    setDbListError('');
  }, [open, initial]);

  if (!open) return null;

  const inputBase = {
    host,
    port,
    username,
    password,
    encrypt,
    trustServerCertificate: trust,
  };

  const canReachServer = host.trim() && username.trim();

  const runTest = async (withDb: boolean) => {
    setTestState('testing');
    setTestMsg('');
    try {
      if (!window.mssqlAPI) {
        setTestState('failed');
        setTestMsg('mssqlAPI ýok — Electron main täzeden başlatyň');
        return;
      }
      const res = await window.mssqlAPI.testConnection({
        ...inputBase,
        database: withDb ? database || 'master' : 'master',
      });
      if (res.ok) {
        setTestState('success');
        setTestMsg(res.serverVersion || 'Baglanyşyk üstünlikli');
      } else {
        setTestState('failed');
        setTestMsg(res.message);
      }
    } catch (e) {
      setTestState('failed');
      setTestMsg((e as Error).message);
    }
  };

  const loadDatabases = async () => {
    setLoadingDbs(true);
    setDbListError('');
    setDatabases([]);
    try {
      if (!window.mssqlAPI) {
        setDbListError('mssqlAPI ýok — npm install mssql && app täzeden başlat');
        return;
      }
      const res = await window.mssqlAPI.listDatabases({
        ...inputBase,
        database: 'master',
      });
      if (res.ok) {
        setDatabases(res.databases);
        if (!res.databases.length) {
          setDbListError('Serwerde database tapylmady');
        }
        // Also mark server test OK
        setTestState('success');
        setTestMsg('Serwer baglanyşygy OK — database saýlaň');
      } else {
        setDbListError(res.message);
        setTestState('failed');
        setTestMsg(res.message);
      }
    } catch (e) {
      setDbListError((e as Error).message);
      setTestState('failed');
      setTestMsg((e as Error).message);
    } finally {
      setLoadingDbs(false);
    }
  };

  const handleSave = async () => {
    // Final test against selected database
    setTestState('testing');
    const res = await window.mssqlAPI?.testConnection({
      ...inputBase,
      database: database || 'master',
    });
    if (!res?.ok) {
      setTestState('failed');
      setTestMsg(res?.message || 'Test şowsuz');
      return;
    }
    setTestState('success');

    const conn: TenantConnection = {
      id: initial?.id || uuid.uuid(),
      label: label.trim() || 'Primary',
      dbType,
      host: host.trim(),
      port: port || 1433,
      database: database.trim(),
      username: username.trim(),
      password,
      encrypt,
      trustServerCertificate: trust,
      isPrimary: initial?.isPrimary ?? false,
      connectionStatus: 'success',
      connectionString: buildMssqlConnectionString({
        host,
        port,
        database,
        username,
        password,
        encrypt,
        trustServerCertificate: trust,
        dbType,
      }),
    };
    onSave(conn);
    onClose();
  };

  const inputCls =
    'w-full bg-surface-raised border border-surface-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/50';
  const labelCls = 'text-xs text-neutral-400';

  return (
    <Modal
      title={isEdit ? 'Database baglanyşygy üýtget' : 'Database baglanyşyk goş'}
      onClose={onClose}
      widthClass="max-w-lg"
    >
      <div className="space-y-3.5">
        <div className="space-y-1.5">
          <label className={labelCls}>Database görnüşi</label>
          <div className="flex flex-wrap gap-2">
            {DB_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                disabled={!opt.enabled}
                onClick={() => {
                  if (!opt.enabled) return;
                  setDbType(opt.id as DbType);
                  setPort(opt.defaultPort || 1433);
                }}
                className={`px-2.5 py-1.5 rounded-md text-xs border transition ${
                  dbType === opt.id
                    ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                    : opt.enabled
                      ? 'border-surface-border text-neutral-300 hover:bg-surface-card'
                      : 'border-surface-border/50 text-neutral-600 cursor-not-allowed opacity-60'
                }`}
              >
                {opt.label}
                {!opt.enabled && <span className="ml-1 text-[10px]">soon</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className={labelCls}>Baglanyşyk ady</label>
          <input className={inputCls} value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>

        {/* 1) Server credentials first */}
        <div className="rounded-lg border border-surface-border bg-surface-card/40 p-3 space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            1. Serwer baglanyşygy
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <label className={labelCls}>Server name / IP *</label>
              <input
                className={`${inputCls} font-mono`}
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="192.168.1.10 ýa-da localhost"
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Port</label>
              <input
                type="number"
                className={`${inputCls} font-mono`}
                value={port}
                onChange={(e) => setPort(Number(e.target.value) || 1433)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={labelCls}>Ulanyjy (User) *</label>
              <input
                className={`${inputCls} font-mono`}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="sa"
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Parol</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className={`${inputCls} font-mono pr-9`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-neutral-400">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={encrypt} onChange={(e) => setEncrypt(e.target.checked)} />
              Encrypt
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={trust} onChange={(e) => setTrust(e.target.checked)} />
              TrustServerCertificate
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              className="!text-xs"
              disabled={!canReachServer || loadingDbs}
              onClick={() => void loadDatabases()}
            >
              <RefreshCw size={12} className={`inline mr-1 ${loadingDbs ? 'animate-spin' : ''}`} />
              {loadingDbs ? 'Birikýär…' : 'Serwere birik we DB sanawy al'}
            </Button>
            <Button
              variant="ghost"
              className="!text-xs"
              disabled={!canReachServer || testState === 'testing'}
              onClick={() => void runTest(false)}
            >
              Diňe test (master)
            </Button>
            {testState !== 'idle' && (
              <Badge
                status={testState === 'testing' ? 'testing' : testState}
                label={testState === 'testing' ? 'Testing…' : testState === 'success' ? 'OK' : 'Failed'}
              />
            )}
          </div>
          {testMsg && (
            <p
              className={`text-[11px] break-words ${
                testState === 'failed' ? 'text-red-400' : 'text-neutral-400'
              }`}
            >
              {testMsg}
            </p>
          )}
          {dbListError && <p className="text-[11px] text-red-400 break-words">{dbListError}</p>}
        </div>

        {/* 2) Database select at bottom — after server works */}
        <div className="rounded-lg border border-surface-border bg-surface-card/40 p-3 space-y-3">
          <div className="flex items-center gap-2">
            <Database size={14} className="text-emerald-400" />
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              2. Database saýla
            </p>
          </div>
          {databases.length > 0 ? (
            <div className="space-y-1.5">
              <label className={labelCls}>Serwerdäki database-ler</label>
              <select
                className={`${inputCls} font-mono`}
                value={database}
                onChange={(e) => setDatabase(e.target.value)}
              >
                <option value="">— saýlaň —</option>
                {databases.map((db) => (
                  <option key={db} value={db}>
                    {db}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="text-[11px] text-neutral-600">
              Ilki ýokardaky «Serwere birik we DB sanawy al» basyň — soň sanaw şu ýerde çykýar.
            </p>
          )}
          <div className="space-y-1.5">
            <label className={labelCls}>Ýa-da el bilen ýaz</label>
            <input
              className={`${inputCls} font-mono`}
              value={database}
              onChange={(e) => setDatabase(e.target.value)}
              placeholder="DatabaseAdy"
            />
          </div>
          {database && (
            <Button
              variant="ghost"
              className="!text-xs"
              disabled={testState === 'testing'}
              onClick={() => void runTest(true)}
            >
              Saýlanan DB bilen test et
            </Button>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-surface-border">
        <Button variant="ghost" className="!text-xs" onClick={onClose}>
          Ýatyr
        </Button>
        <Button
          className="!text-xs"
          disabled={!host.trim() || !username.trim() || !database.trim()}
          onClick={() => void handleSave()}
        >
          {isEdit ? 'Sakla' : 'Goş'}
        </Button>
      </div>
    </Modal>
  );
}
