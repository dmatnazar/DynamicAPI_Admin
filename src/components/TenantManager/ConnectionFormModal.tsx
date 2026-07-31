import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Eye, EyeOff } from 'lucide-react';
import {
  DB_TYPE_LABELS,
  SUPPORTED_DB_TYPES,
  defaultPortForDbType,
  type DbConnection,
  type DbType,
} from '../../types/endpoint.types';

const ALL_DB_TYPES = Object.keys(DB_TYPE_LABELS) as DbType[];

export type ConnectionFormValues = Omit<DbConnection, 'id' | 'status'>;

interface Props {
  mode: 'create' | 'edit';
  initial?: DbConnection;
  onClose: () => void;
  onSubmit: (values: ConnectionFormValues) => void;
}

export function ConnectionFormModal({ mode, initial, onClose, onSubmit }: Props) {
  const [dbType, setDbType] = useState<DbType>(initial?.dbType ?? 'mssql');
  const [connectionName, setConnectionName] = useState(initial?.connectionName ?? '');
  const [host, setHost] = useState(initial?.host ?? '');
  const [port, setPort] = useState(initial?.port ?? defaultPortForDbType('mssql'));
  const [username, setUsername] = useState(initial?.username ?? '');
  const [password, setPassword] = useState(initial?.password ?? '');
  const [database, setDatabase] = useState(initial?.database ?? '');
  const [showPassword, setShowPassword] = useState(false);

  const isSupported = SUPPORTED_DB_TYPES.includes(dbType);
  const canSubmit =
    isSupported && connectionName.trim() && host.trim() && username.trim() && database.trim();

  const changeDbType = (t: DbType) => {
    setDbType(t);
    if (!initial) setPort(defaultPortForDbType(t));
  };

  const submit = () => {
    if (!canSubmit) return;
    onSubmit({
      dbType,
      connectionName: connectionName.trim(),
      host: host.trim(),
      port,
      username: username.trim(),
      password,
      database: database.trim(),
    });
  };

  return (
    <Modal
      title={mode === 'create' ? 'Täze connection goş' : 'Connection-y üýtget'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Ýatyr
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {mode === 'create' ? 'Goş' : 'Ýatda sakla'}
          </Button>
        </>
      }
    >
      <div className="space-y-1.5">
        <label className="text-xs text-neutral-400">Database görnüşi</label>
        <select
          className="w-full bg-surface-card border border-surface-border rounded-md px-3 py-2 text-sm"
          value={dbType}
          onChange={(e) => changeDbType(e.target.value as DbType)}
        >
          {ALL_DB_TYPES.map((t) => (
            <option key={t} value={t} disabled={!SUPPORTED_DB_TYPES.includes(t)}>
              {DB_TYPE_LABELS[t]}
              {!SUPPORTED_DB_TYPES.includes(t) ? ' (ýakynda)' : ''}
            </option>
          ))}
        </select>
        {!isSupported && (
          <p className="text-[11px] text-amber-400">
            Bu database görnüşi entek goldanmaýar — häzirlikçe diňe MSSQL işleýär.
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-neutral-400">Connection ady</label>
        <input
          className="w-full bg-surface-card border border-surface-border rounded-md px-3 py-2 text-sm"
          placeholder="Mysal: Esasy filial DB"
          value={connectionName}
          onChange={(e) => setConnectionName(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2 space-y-1.5">
          <label className="text-xs text-neutral-400">Server salgysy (host)</label>
          <input
            className="w-full bg-surface-card border border-surface-border rounded-md px-3 py-2 text-sm font-mono"
            placeholder="192.168.1.10 ýa-da localhost"
            value={host}
            onChange={(e) => setHost(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-neutral-400">Port</label>
          <input
            type="number"
            className="w-full bg-surface-card border border-surface-border rounded-md px-3 py-2 text-sm font-mono"
            value={port}
            onChange={(e) => setPort(Number(e.target.value))}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs text-neutral-400">Ulanyjy ady (username)</label>
          <input
            className="w-full bg-surface-card border border-surface-border rounded-md px-3 py-2 text-sm font-mono"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-neutral-400">Parol</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              className="w-full bg-surface-card border border-surface-border rounded-md px-3 py-2 pr-9 text-sm font-mono"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-200"
            >
              {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-neutral-400">Database ady</label>
        <input
          className="w-full bg-surface-card border border-surface-border rounded-md px-3 py-2 text-sm font-mono"
          placeholder="Mysal: CompanyDB"
          value={database}
          onChange={(e) => setDatabase(e.target.value)}
        />
      </div>
    </Modal>
  );
}
