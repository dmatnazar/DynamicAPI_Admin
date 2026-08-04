export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export type ParamType = 'int' | 'bigint' | 'date' | 'datetime' | 'nvarchar' | 'bit' | 'float';

export interface ParamDef {
  name: string;
  sqlParam: string;
  type: ParamType;
  required: boolean;
  default?: unknown;
}

export interface ParamsSchema {
  urlParams: ParamDef[];
  queryParams: ParamDef[];
  bodyParams: ParamDef[];
}

export interface EndpointConfig {
  id: string;
  name: string;
  method: HttpMethod;
  pathTemplate: string;
  sqlQuery: string;
  paramsSchema: ParamsSchema;
  responseSchema?: Record<string, unknown>;
  cacheTtlSec: number;
  authRequired: boolean;
}

/**
 * A single named MSSQL connection belonging to a company. A company can have
 * more than one (e.g. a production DB + a read-only reporting replica).
 * Exactly one connection should have isPrimary=true at any time — that's the
 * one used for live API queries and for "One-Click Sync to VPS".
 */
export interface TenantConnection {
  id: string;
  label: string;
  connectionString: string;
  isPrimary: boolean;
  connectionStatus: 'unknown' | 'testing' | 'success' | 'failed';
}

export interface TenantConfig {
  id: string;
  slug: string;
  name: string;
  // Mirror of the primary connection's string/status, kept in sync by
  // useTenantStore. Exists so existing call sites (SyncStatusCard, lib/api.ts)
  // that only know about a single connection keep working unchanged.
  dbConnectionString: string; // held only in-memory / vault, never synced in plaintext logs
  connectionStatus: 'unknown' | 'testing' | 'success' | 'failed';
  connections: TenantConnection[];
}


export function buildMssqlConnectionString(config: {
  server?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
}): string {
  if (!config) return '';
  const { server = '', port = 1433, database = '', user = '', password = '' } = config;
  return `Server=${server},${port};Database=${database};User Id=${user};Password=${password};Encrypt=true;TrustServerCertificate=true;`;
}