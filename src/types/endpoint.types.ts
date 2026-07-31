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

// Only 'mssql' is wired up end-to-end today (the gateway only speaks MSSQL).
// The rest are listed so the dropdown reads correctly and future backends
// can be added without another type migration.
export type DbType = 'mssql' | 'postgres' | 'mysql' | 'oracle';

export const DB_TYPE_LABELS: Record<DbType, string> = {
  mssql: 'Microsoft SQL Server',
  postgres: 'PostgreSQL',
  mysql: 'MySQL',
  oracle: 'Oracle',
};

// Which DB types are actually usable right now. Others show in the
// dropdown as "(ýakynda)" and can't be selected yet.
export const SUPPORTED_DB_TYPES: DbType[] = ['mssql'];

export interface DbConnection {
  id: string;
  dbType: DbType;
  connectionName: string; // friendly label, e.g. "Main branch DB"
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  status: 'unknown' | 'testing' | 'success' | 'failed';
}

export interface TenantConfig {
  id: string;
  slug: string;
  name: string; // short/display name
  fullName: string; // legal / full company name
  phones: string[];
  address: string;
  connections: DbConnection[];
  activeConnectionId: string | null;
}

export function defaultPortForDbType(type: DbType): number {
  switch (type) {
    case 'mssql':
      return 1433;
    case 'postgres':
      return 5432;
    case 'mysql':
      return 3306;
    case 'oracle':
      return 1521;
  }
}

/** Builds a `mssql`/tedious-compatible connection string from a DbConnection. */
export function buildMssqlConnectionString(conn: DbConnection): string {
  return `Server=${conn.host},${conn.port};Database=${conn.database};User Id=${conn.username};Password=${conn.password};Encrypt=true;TrustServerCertificate=true;`;
}
