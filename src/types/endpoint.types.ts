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

export interface TenantConfig {
  id: string;
  slug: string;
  name: string;
  dbConnectionString: string; // held only in-memory / vault, never synced in plaintext logs
  connectionStatus: 'unknown' | 'testing' | 'success' | 'failed';
}
