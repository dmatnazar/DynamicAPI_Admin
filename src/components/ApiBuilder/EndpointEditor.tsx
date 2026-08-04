import type { EndpointConfig, HttpMethod } from '../../types/endpoint.types';
import { SqlEditor } from './SqlEditor';
import { ParamMapper } from './ParamMapper';

interface Props {
  endpoint: EndpointConfig;
  onChange: (patch: Partial<EndpointConfig>) => void;
}

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE'];

export function EndpointEditor({ endpoint, onChange }: Props) {
  const allParams = [
    ...endpoint.paramsSchema.urlParams,
    ...endpoint.paramsSchema.queryParams,
    ...endpoint.paramsSchema.bodyParams,
  ]
    .map((p) => p.sqlParam)
    .filter(Boolean);

  return (
    <div className="space-y-4 min-w-0">
      <div className="flex flex-col sm:flex-row gap-3">
        <select
          className="bg-surface-card border border-surface-border rounded-md px-2.5 py-2 text-sm font-semibold text-neutral-100 sm:w-auto w-full"
          value={endpoint.method}
          onChange={(e) => onChange({ method: e.target.value as HttpMethod })}
        >
          {METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <input
          className="flex-1 min-w-0 bg-surface-card border border-surface-border rounded-md px-3 py-2 text-sm font-mono text-neutral-100"
          placeholder="/branches/:branchId/sales"
          value={endpoint.pathTemplate}
          onChange={(e) => onChange({ pathTemplate: e.target.value })}
        />
      </div>

      <input
        className="w-full bg-surface-card border border-surface-border rounded-md px-3 py-2 text-sm text-neutral-100"
        placeholder="Endpoint name (e.g. getBranchSales)"
        value={endpoint.name}
        onChange={(e) => onChange({ name: e.target.value })}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        <ParamMapper
          title="URL Params"
          hint="From the path, e.g. :branchId"
          params={endpoint.paramsSchema.urlParams}
          onChange={(p) => onChange({ paramsSchema: { ...endpoint.paramsSchema, urlParams: p } })}
        />
        <ParamMapper
          title="Query Params"
          hint="From ?query=string"
          params={endpoint.paramsSchema.queryParams}
          onChange={(p) => onChange({ paramsSchema: { ...endpoint.paramsSchema, queryParams: p } })}
        />
        <ParamMapper
          title="Body Params"
          hint="From JSON body"
          params={endpoint.paramsSchema.bodyParams}
          onChange={(p) => onChange({ paramsSchema: { ...endpoint.paramsSchema, bodyParams: p } })}
        />
      </div>

      <div className="min-w-0">
        <h4 className="text-sm font-medium text-neutral-100 mb-1.5">MSSQL Query</h4>
        <SqlEditor
          value={endpoint.sqlQuery}
          onChange={(v) => onChange({ sqlQuery: v })}
          availableParams={allParams}
        />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 pt-1">
        <label className="flex items-center gap-2 text-sm text-neutral-300">
          <input
            type="checkbox"
            checked={endpoint.authRequired}
            onChange={(e) => onChange({ authRequired: e.target.checked })}
          />
          Require API Key / Bearer token
        </label>
        <label className="flex items-center gap-2 text-sm text-neutral-300">
          Cache TTL (sec)
          <input
            type="number"
            min={0}
            className="w-20 bg-surface-card border border-surface-border rounded-md px-2 py-1 text-sm"
            value={endpoint.cacheTtlSec}
            onChange={(e) => onChange({ cacheTtlSec: Number(e.target.value) })}
          />
        </label>
      </div>
    </div>
  );
}
