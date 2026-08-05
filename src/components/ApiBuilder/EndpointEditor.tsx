import { useMemo } from 'react';
import type { EndpointConfig, HttpMethod, TenantConfig } from '../../types/endpoint.types';
import { buildApiUrl } from '../../lib/apiUrl';
import { SqlEditor } from './SqlEditor';
import { ParamMapper } from './ParamMapper';
import {
  syncUrlParamsFromPath,
  extractSqlParams,
} from '../../lib/endpointHelpers';

interface Props {
  endpoint: EndpointConfig;
  onChange: (patch: Partial<EndpointConfig>) => void;
  pathError?: string | null;
  duplicateError?: string | null;
  /** All companies — for selector */
  tenants: TenantConfig[];
  /** Currently selected company (resolved from endpoint.companyId or parent) */
  tenant: TenantConfig | null;
  gatewayUrl: string;
  /** When user picks another company, parent should move endpoint in store */
  onCompanyChange?: (companyId: string) => void;
}

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE'];

function safeParamsSchema(endpoint: EndpointConfig) {
  const schema = endpoint?.paramsSchema;
  return {
    urlParams: Array.isArray(schema?.urlParams) ? schema.urlParams : [],
    queryParams: Array.isArray(schema?.queryParams) ? schema.queryParams : [],
    bodyParams: Array.isArray(schema?.bodyParams) ? schema.bodyParams : [],
  };
}

export function EndpointEditor({
  endpoint,
  onChange,
  pathError,
  duplicateError,
  tenants,
  tenant,
  gatewayUrl,
  onCompanyChange,
}: Props) {
  console.log('[EndpointEditor] render', {
    id: endpoint?.id,
    name: endpoint?.name,
    method: endpoint?.method,
    path: endpoint?.pathTemplate,
    companyId: endpoint?.companyId,
    connectionId: endpoint?.connectionId,
    tenantId: tenant?.id,
    tenantSlug: tenant?.slug,
  });

  const paramsSchema = safeParamsSchema(endpoint);

  const allParams = [
    ...paramsSchema.urlParams,
    ...paramsSchema.queryParams,
    ...paramsSchema.bodyParams,
  ]
    .map((p) => p.sqlParam)
    .filter(Boolean);

  const sqlOnlyParams = useMemo(() => {
    const mapped = new Set(allParams.map((s) => s.replace(/^@/, '').toLowerCase()));
    return extractSqlParams(endpoint.sqlQuery || '').filter((n) => !mapped.has(n.toLowerCase()));
  }, [endpoint.sqlQuery, allParams]);

  const handlePathChange = (path: string) => {
    const nextSchema = syncUrlParamsFromPath(paramsSchema, path);
    onChange({ pathTemplate: path, paramsSchema: nextSchema });
  };

  const addSqlParamsToQuery = () => {
    if (!sqlOnlyParams.length) return;
    const newQuery = sqlOnlyParams.map((name) => ({
      name,
      sqlParam: `@${name}`,
      type: 'nvarchar' as const,
      required: false,
    }));
    onChange({
      paramsSchema: {
        ...paramsSchema,
        queryParams: [...paramsSchema.queryParams, ...newQuery],
      },
    });
  };

  const connections = tenant?.connections ?? [];
  const selectedConnId =
    endpoint.connectionId ||
    connections.find((c) => c.isPrimary)?.id ||
    connections[0]?.id ||
    '';

  const fullUrl = buildApiUrl(gatewayUrl, tenant, {
    ...endpoint,
    connectionId: selectedConnId || endpoint.connectionId,
  });

  const inputCls =
    'w-full bg-surface-card border border-surface-border rounded-md px-3 py-2 text-sm text-neutral-100';
  const labelCls = 'text-xs text-neutral-400';

  return (
    <div className="space-y-4 min-w-0">
      {/* Company + Database selectors */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border border-surface-border bg-surface-raised/40 p-3">
        <div className="space-y-1.5">
          <label className={labelCls}>Kompaniýa *</label>
          <select
            className={inputCls}
            value={tenant?.id || endpoint.companyId || ''}
            onChange={(e) => {
              const id = e.target.value;
              console.log('[EndpointEditor] company change →', id);
              onChange({ companyId: id, connectionId: undefined });
              onCompanyChange?.(id);
            }}
          >
            <option value="" disabled>
              Kompaniýa saýla…
            </option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} (/{t.slug})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className={labelCls}>Database baglanyşyk *</label>
          <select
            className={inputCls}
            value={selectedConnId}
            disabled={!tenant || connections.length === 0}
            onChange={(e) => {
              console.log('[EndpointEditor] connection change →', e.target.value);
              onChange({ connectionId: e.target.value });
            }}
          >
            {connections.length === 0 ? (
              <option value="">Ilki Companies-de DB goşuň</option>
            ) : (
              connections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label} — {c.database} ({c.host})
                  {c.isPrimary ? ' ★' : ''}
                </option>
              ))
            )}
          </select>
        </div>
        <div className="sm:col-span-2 space-y-1">
          <label className={labelCls}>Doly API URL</label>
          <p className="text-[11px] font-mono text-emerald-400/90 break-all bg-surface-card border border-surface-border rounded-md px-2.5 py-2">
            {fullUrl}
          </p>
          {/* IMPORTANT: curly braces must be escaped in JSX text, otherwise React treats them as JS variables and crashes */}
          <p className="text-[10px] text-neutral-600">
            Format:{' '}
            <span className="font-mono text-neutral-500">
              {'/api/v1/{companySlug}/{dbKey}{path}'}
            </span>
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <select
          className="bg-surface-card border border-surface-border rounded-md px-2.5 py-2 text-sm font-semibold text-neutral-100 sm:w-28 w-full"
          value={endpoint.method}
          onChange={(e) => onChange({ method: e.target.value as HttpMethod })}
        >
          {METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex rounded-md border border-surface-border bg-surface-card overflow-hidden focus-within:ring-1 focus-within:ring-blue-500/50">
            <span className="shrink-0 px-2.5 py-2 text-xs font-mono text-neutral-500 bg-surface-raised border-r border-surface-border select-none">
              PATH
            </span>
            <input
              className="flex-1 min-w-0 bg-transparent px-3 py-2 text-sm font-mono text-neutral-100 outline-none"
              placeholder="/test ýa-da /users/:id"
              value={endpoint.pathTemplate || ''}
              onChange={(e) =>
                handlePathChange(e.target.value.startsWith('/') ? e.target.value : `/${e.target.value}`)
              }
            />
          </div>
          {(pathError || duplicateError) && (
            <p className="text-[11px] text-red-400">{pathError || duplicateError}</p>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <label className={labelCls}>Endpoint ady</label>
        <input
          className={inputCls}
          placeholder="getBranchSales"
          value={endpoint.name || ''}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        <ParamMapper
          title="URL Params"
          hint="Path-dan :param"
          params={paramsSchema.urlParams}
          onChange={(p) => onChange({ paramsSchema: { ...paramsSchema, urlParams: p } })}
        />
        <ParamMapper
          title="Query Params"
          hint="?key=value"
          params={paramsSchema.queryParams}
          onChange={(p) => onChange({ paramsSchema: { ...paramsSchema, queryParams: p } })}
        />
        <ParamMapper
          title="Body Params"
          hint="JSON body"
          params={paramsSchema.bodyParams}
          onChange={(p) => onChange({ paramsSchema: { ...paramsSchema, bodyParams: p } })}
        />
      </div>

      {sqlOnlyParams.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
          <span className="text-[11px] text-amber-300">
            SQL-de map edilmedik: {sqlOnlyParams.map((p) => `@${p}`).join(', ')}
          </span>
          <button
            type="button"
            onClick={addSqlParamsToQuery}
            className="text-[11px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-200 hover:bg-amber-500/30"
          >
            Query Params-a goş
          </button>
        </div>
      )}

      <div className="space-y-1.5">
        <label className={labelCls}>SQL Query</label>
        <SqlEditor
          value={endpoint.sqlQuery || ''}
          onChange={(v) => onChange({ sqlQuery: v })}
          availableParams={allParams}
        />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 pt-1 flex-wrap">
        <label className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer">
          <input
            type="checkbox"
            checked={!!endpoint.authRequired}
            onChange={(e) => onChange({ authRequired: e.target.checked })}
            className="rounded border-surface-border"
          />
          API Key / Bearer token talap et
        </label>
        <label className="flex items-center gap-2 text-sm text-neutral-300">
          Cache TTL (sek)
          <input
            type="number"
            min={0}
            className="w-20 bg-surface-card border border-surface-border rounded-md px-2 py-1 text-sm"
            value={endpoint.cacheTtlSec ?? 0}
            onChange={(e) => onChange({ cacheTtlSec: Number(e.target.value) })}
          />
        </label>
      </div>
    </div>
  );
}
