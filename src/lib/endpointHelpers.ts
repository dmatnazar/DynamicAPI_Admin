import type { EndpointConfig, ParamDef, ParamsSchema } from '../types/endpoint.types';

const PATH_RE = /^\/[A-Za-z0-9_\-.{}\/:]*$/;

/** Validate REST path template */
export function validatePathTemplate(path: string): string | null {
  if (!path || !path.startsWith('/')) return 'Path "/" bilen başlamaly';
  if (path.includes(' ')) return 'Path-da boşluk bolmaly däl';
  if (!PATH_RE.test(path)) return 'Path-da rugsat edilmedik simwollar bar';
  return null;
}

/** Extract :paramName from path → urlParams stubs */
export function extractPathParams(path: string): ParamDef[] {
  const names = [...path.matchAll(/:([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1]);
  const unique = [...new Set(names)];
  return unique.map((name) => ({
    name,
    sqlParam: `@${name}`,
    type: 'nvarchar' as const,
    required: true,
  }));
}

/** Extract @param from SQL that are not already mapped */
export function extractSqlParams(sql: string): string[] {
  const found = [...sql.matchAll(/@([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1]);
  return [...new Set(found)];
}

/** Merge path-extracted params into urlParams without wiping custom fields */
export function syncUrlParamsFromPath(schema: ParamsSchema, path: string): ParamsSchema {
  const fromPath = extractPathParams(path);
  const existing = new Map(schema.urlParams.map((p) => [p.name, p]));
  const urlParams = fromPath.map((p) => existing.get(p.name) ?? p);
  // Keep any extra url params user added that aren't in path? Drop orphans from path changes.
  return { ...schema, urlParams };
}

/** Check method+path uniqueness within list (excluding self id) */
export function findDuplicateEndpoint(
  list: EndpointConfig[],
  method: string,
  path: string,
  excludeId?: string,
  connectionId?: string
): EndpointConfig | undefined {
  const norm = path.replace(/\/+$/, '') || '/';
  return list.find((e) => {
    if (e.id === excludeId) return false;
    if (e.method !== method) return false;
    if ((e.pathTemplate.replace(/\/+$/, '') || '/') !== norm) return false;
    // Same path+method on same DB connection = duplicate
    if (connectionId && e.connectionId && e.connectionId !== connectionId) return false;
    return true;
  });
}

/** Suggest unique path when duplicating */
export function uniquePath(list: EndpointConfig[], basePath: string): string {
  const norm = basePath.replace(/\/+$/, '') || '/';
  let candidate = norm.endsWith('-copy') ? norm : `${norm}-copy`;
  let i = 2;
  while (list.some((e) => (e.pathTemplate.replace(/\/+$/, '') || '/') === candidate)) {
    candidate = `${norm}-copy${i}`;
    i += 1;
  }
  return candidate;
}

export function exportEndpointsJson(endpoints: EndpointConfig[]): string {
  return JSON.stringify(
    endpoints.map(({ id: _id, ...rest }) => rest),
    null,
    2
  );
}

export function importEndpointsJson(raw: string): Omit<EndpointConfig, 'id'>[] {
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error('JSON array garaşylýar');
  return data.map((item) => ({
    name: String(item.name || 'imported'),
    method: item.method || 'GET',
    pathTemplate: item.pathTemplate || '/',
    sqlQuery: item.sqlQuery || '',
    paramsSchema: item.paramsSchema || { urlParams: [], queryParams: [], bodyParams: [] },
    responseSchema: item.responseSchema,
    cacheTtlSec: Number(item.cacheTtlSec) || 0,
    authRequired: item.authRequired !== false,
  }));
}
