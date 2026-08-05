import { useMemo, useState, useCallback } from 'react';
import {
  ArrowLeft,
  Maximize2,
  Minimize2,
  Save,
  Play,
  Copy,
  ClipboardPaste,
  Eraser,
  AlignLeft,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { CodeMirrorSqlEditor } from './CodeMirrorSqlEditor';
import { confirmDialog } from '../ui/ConfirmDialog';
import { copyText } from '../../lib/apiUrl';
import type { EndpointConfig, ParamDef, TenantConnection } from '../../types/endpoint.types';

interface Props {
  endpoint: EndpointConfig;
  availableParams: ParamDef[];
  /** Active DB connection for this endpoint (required for real Execute) */
  connection: TenantConnection | null;
  onChange: (patch: Partial<EndpointConfig>) => void;
  onBack: () => void;
}

type ResultRow = Record<string, unknown>;

export function QueryEditorPage({
  endpoint,
  availableParams,
  connection,
  onChange,
  onBack,
}: Props) {
  const [draft, setDraft] = useState(endpoint.sqlQuery);
  const [fullscreen, setFullscreen] = useState(false);
  const [paramValues, setParamValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const p of availableParams) {
      init[p.sqlParam || p.name] = p.default != null ? String(p.default) : '';
    }
    return init;
  });
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ResultRow[] | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const dirty = draft !== endpoint.sqlQuery;
  const paramKeys = useMemo(
    () => availableParams.map((p) => p.sqlParam || `@${p.name}`),
    [availableParams]
  );

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1600);
  };

  const requestClose = async () => {
    if (dirty) {
      const ok = await confirmDialog({
        title: 'Üýtgeşmeler saklanmady',
        message: 'Ýazylan SQL üýtgeşmeleri ýitirilsinmi? (Ilki «Ýaz» basyp saklap bilersiňiz)',
        confirmLabel: 'Ýitir we çyk',
        cancelLabel: 'Gal',
        danger: true,
      });
      if (!ok) return;
    }
    onBack();
  };

  const save = () => {
    onChange({ sqlQuery: draft });
    showToast('SQL saklandy');
  };

  const saveAndClose = () => {
    onChange({ sqlQuery: draft });
    onBack();
  };

  const handleCopySql = async () => {
    if (await copyText(draft)) showToast('SQL copy edildi');
  };

  const handlePasteSql = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setDraft(text);
        showToast('Paste edildi');
      }
    } catch {
      showToast('Clipboard okap bolmady — Ctrl+V ulanyň');
    }
  };

  const handleFormat = () => {
    const keywords = [
      'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'JOIN', 'LEFT', 'RIGHT', 'INNER',
      'OUTER', 'ON', 'GROUP BY', 'ORDER BY', 'HAVING', 'INSERT', 'UPDATE', 'DELETE',
      'VALUES', 'SET', 'INTO', 'AS', 'TOP', 'DISTINCT', 'UNION',
    ];
    let sql = draft.replace(/\s+/g, ' ').trim();
    for (const kw of keywords) {
      const re = new RegExp(`\\b${kw}\\b`, 'gi');
      sql = sql.replace(re, `\n${kw}`);
    }
    sql = sql
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .join('\n');
    setDraft(sql);
    showToast('Formatlandy');
  };

  const handleClear = async () => {
    const ok = await confirmDialog({
      title: 'SQL arassala',
      message: 'Ähli SQL teksti pozulsynmy?',
      confirmLabel: 'Arassala',
      danger: true,
    });
    if (ok) {
      setDraft('');
      setRows(null);
      setError(null);
    }
  };

  const handleExecute = useCallback(async () => {
    setRunning(true);
    setError(null);
    setRows(null);
    const t0 = performance.now();

    console.log('[QueryEditor] Execute start', {
      hasConnection: !!connection,
      host: connection?.host,
      database: connection?.database,
      sqlLength: draft.length,
      paramKeys,
    });

    try {
      if (!connection?.host || !connection?.username) {
        setError(
          'Database baglanyşyk ýok. Companies → kompaniýa → Connections-de host/username dolduryň.'
        );
        setElapsedMs(Math.round(performance.now() - t0));
        return;
      }

      if (!window.mssqlAPI?.executeQuery) {
        setError(
          'mssqlAPI.executeQuery elýeterli däl. Electron main/preload täzelenmedik bolup biler — npm run dev täzeden işlediň.'
        );
        setElapsedMs(Math.round(performance.now() - t0));
        return;
      }

      // Build params for mssql (keys without @)
      const params: Record<string, unknown> = {};
      for (const p of availableParams) {
        const key = p.sqlParam || `@${p.name}`;
        const raw = paramValues[key];
        if (raw === undefined || raw === '') {
          if (p.required) {
            setError(`Required parametr boş: ${key}`);
            setElapsedMs(Math.round(performance.now() - t0));
            return;
          }
          continue;
        }
        const name = key.startsWith('@') ? key.slice(1) : key;
        // Coerce simple types
        if (p.type === 'int' || p.type === 'bigint') {
          params[name] = Number(raw);
        } else if (p.type === 'float') {
          params[name] = parseFloat(raw);
        } else if (p.type === 'bit') {
          params[name] = raw === '1' || raw.toLowerCase() === 'true';
        } else {
          params[name] = raw;
        }
      }

      const result = await window.mssqlAPI.executeQuery({
        host: connection.host,
        port: connection.port,
        database: connection.database,
        username: connection.username,
        password: connection.password,
        encrypt: connection.encrypt,
        trustServerCertificate: connection.trustServerCertificate,
        sqlQuery: draft,
        params,
      });

      console.log('[QueryEditor] Execute result', result);

      if (!result.ok) {
        setError(result.message);
        setElapsedMs(Math.round(performance.now() - t0));
        return;
      }

      setRows(result.rows);
      setElapsedMs(result.elapsedMs ?? Math.round(performance.now() - t0));
    } catch (e) {
      console.error('[QueryEditor] Execute error', e);
      setError((e as Error).message);
      setElapsedMs(Math.round(performance.now() - t0));
    } finally {
      setRunning(false);
    }
  }, [availableParams, connection, draft, paramKeys, paramValues]);

  const columns = useMemo(() => {
    if (!rows?.length) return [];
    const keys = new Set<string>();
    for (const r of rows) Object.keys(r).forEach((k) => keys.add(k));
    return [...keys];
  }, [rows]);

  return (
    <div
      className={
        fullscreen
          ? 'fixed inset-0 z-50 bg-surface flex flex-col'
          : 'flex flex-col h-full min-h-0 p-4 sm:p-6'
      }
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 pb-3 shrink-0 border-b border-surface-border mb-3">
        <Button variant="ghost" className="!px-2" onClick={() => void requestClose()} title="Yza">
          <ArrowLeft size={16} />
        </Button>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-neutral-100 truncate">
            {endpoint.name || 'Endpoint'} — Query Editor
          </h2>
          <p className="text-[11px] text-neutral-500 font-mono truncate">
            {endpoint.method} {endpoint.pathTemplate}
            {connection && (
              <span className="ml-2 text-neutral-600">
                · {connection.label} ({connection.host}/{connection.database})
              </span>
            )}
          </p>
        </div>
        <div className="flex-1" />
        {dirty && <span className="text-[11px] text-amber-400">Saklanmadyk üýtgeşme</span>}
        {toast && <span className="text-[11px] text-emerald-400">{toast}</span>}

        <Button variant="ghost" className="!px-2 !text-xs" onClick={() => void handleCopySql()} title="Copy SQL">
          <Copy size={14} />
        </Button>
        <Button variant="ghost" className="!px-2 !text-xs" onClick={() => void handlePasteSql()} title="Paste SQL">
          <ClipboardPaste size={14} />
        </Button>
        <Button variant="ghost" className="!px-2 !text-xs" onClick={handleFormat} title="Format">
          <AlignLeft size={14} />
        </Button>
        <Button variant="ghost" className="!px-2 !text-xs" onClick={() => void handleClear()} title="Clear">
          <Eraser size={14} />
        </Button>
        <Button
          variant="ghost"
          className="!px-2"
          onClick={() => setFullscreen((v) => !v)}
          title={fullscreen ? 'Kiçelt' : 'Doly ekran'}
        >
          {fullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </Button>
        <Button variant="secondary" className="!text-xs" onClick={save} disabled={!dirty}>
          <Save size={13} className="inline mr-1" />
          Ýaz
        </Button>
        <Button className="!text-xs" onClick={() => void handleExecute()} disabled={running || !draft.trim()}>
          <Play size={13} className="inline mr-1" />
          {running ? 'Execute…' : 'Execute'}
        </Button>
        <Button variant="ghost" className="!text-xs" onClick={saveAndClose}>
          Ýaz we ýap
        </Button>
      </div>

      {!connection && (
        <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          Bu endpoint üçin database baglanyşyk saýlanmady. Companies-de connection goşuň ýa-da
          Endpoint Editor-da Database saýlaň.
        </div>
      )}

      <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-4 gap-3">
        {/* Params panel */}
        <div className="xl:col-span-1 rounded-xl border border-surface-border bg-surface-card p-3 space-y-2 overflow-y-auto max-h-[40vh] xl:max-h-none">
          <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">Parametrler</h3>
          {availableParams.length === 0 && (
            <p className="text-[11px] text-neutral-600">Parametr ýok. Path / schema-dan goşuň.</p>
          )}
          {availableParams.map((p) => {
            const key = p.sqlParam || `@${p.name}`;
            return (
              <div key={key} className="space-y-1">
                <label className="text-[11px] font-mono text-neutral-400">
                  {key}
                  <span className="text-neutral-600 ml-1">({p.type})</span>
                  {p.required && <span className="text-red-400 ml-0.5">*</span>}
                </label>
                <input
                  className="w-full bg-surface-raised border border-surface-border rounded-md px-2 py-1.5 text-xs font-mono"
                  value={paramValues[key] ?? ''}
                  onChange={(e) => setParamValues((s) => ({ ...s, [key]: e.target.value }))}
                  placeholder={p.required ? 'required' : 'optional'}
                />
              </div>
            );
          })}
          <p className="text-[10px] text-neutral-600 pt-1">
            Ctrl+Space — autocomplete · Ctrl+C/V — copy/paste
          </p>
        </div>

        {/* Editor + results */}
        <div className="xl:col-span-3 flex flex-col min-h-0 gap-3">
          <div className="flex-1 min-h-[200px] rounded-xl border border-surface-border overflow-hidden">
            <CodeMirrorSqlEditor
              value={draft}
              onChange={setDraft}
              availableParams={paramKeys}
              autoFocus
              height="100%"
            />
          </div>

          {/* Results */}
          <div className="shrink-0 rounded-xl border border-surface-border bg-surface-card overflow-hidden max-h-[40vh] flex flex-col">
            <div className="flex items-center justify-between px-3 py-2 border-b border-surface-border">
              <span className="text-xs font-semibold text-neutral-300">Netije</span>
              {elapsedMs != null && (
                <span className="text-[10px] text-neutral-500">
                  {rows?.length ?? 0} setir · {elapsedMs} ms
                </span>
              )}
            </div>
            {error && (
              <p className="text-xs text-red-400 px-3 py-2 border-b border-surface-border whitespace-pre-wrap">
                {error}
              </p>
            )}
            {!rows && !error && (
              <p className="text-xs text-neutral-600 px-3 py-4 text-center">
                Execute basyp SQL-i hakyky MSSQL-de synag ediň — netije aşakda table görnüşinde çykýar
              </p>
            )}
            {rows && rows.length > 0 && (
              <div className="overflow-auto flex-1">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-surface-raised">
                    <tr>
                      {columns.map((col) => (
                        <th
                          key={col}
                          className="px-3 py-2 font-semibold text-neutral-400 border-b border-surface-border whitespace-nowrap"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} className="hover:bg-surface-raised/50">
                        {columns.map((col) => (
                          <td
                            key={col}
                            className="px-3 py-1.5 font-mono text-neutral-300 border-b border-surface-border/50 max-w-[240px] truncate"
                            title={String(row[col] ?? '')}
                          >
                            {row[col] == null ? (
                              <span className="text-neutral-600">NULL</span>
                            ) : (
                              String(row[col])
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {rows && rows.length === 0 && (
              <p className="text-xs text-neutral-500 px-3 py-4 text-center">0 setir gaýtaryldy</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
