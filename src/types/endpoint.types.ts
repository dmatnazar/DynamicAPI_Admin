export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export type ParamType = 'int' | 'bigint' | 'date' | 'datetime' | 'nvarchar' | 'bit' | 'float';

export type DbType = 'mssql' | 'postgresql' | 'mysql' | 'oracle' | 'sqlite';

export const DB_TYPE_OPTIONS: { id: DbType; label: string; enabled: boolean; defaultPort: number }[] = [
  { id: 'mssql', label: 'Microsoft SQL Server', enabled: true, defaultPort: 1433 },
  { id: 'postgresql', label: 'PostgreSQL', enabled: false, defaultPort: 5432 },
  { id: 'mysql', label: 'MySQL / MariaDB', enabled: false, defaultPort: 3306 },
  { id: 'oracle', label: 'Oracle', enabled: false, defaultPort: 1521 },
  { id: 'sqlite', label: 'SQLite', enabled: false, defaultPort: 0 },
];

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
  /** Relative path only, e.g. /sales or /users/:id — company & DB are prefixed in full URL */
  pathTemplate: string;
  sqlQuery: string;
  paramsSchema: ParamsSchema;
  responseSchema?: Record<string, unknown>;
  cacheTtlSec: number;
  authRequired: boolean;
  /** Which company this endpoint belongs to (redundant with store key, kept for URL/sync) */
  companyId?: string;
  /** Which DB connection of the company to query */
  connectionId?: string;
}

/**
 * A single named DB connection belonging to a company.
 */
export interface TenantConnection {
  id: string;
  label: string;
  dbType: DbType;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  encrypt: boolean;
  trustServerCertificate: boolean;
  isPrimary: boolean;
  connectionStatus: 'unknown' | 'testing' | 'success' | 'failed';
  connectionString?: string;
}

export interface CompanyProfile {
  legalName?: string;
  taxId?: string;
  registrationNumber?: string;
  industry?: string;
  country?: string;
  city?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  notes?: string;
}

export interface TenantConfig extends CompanyProfile {
  id: string;
  slug: string;
  name: string;
  dbConnectionString: string;
  connectionStatus: 'unknown' | 'testing' | 'success' | 'failed';
  connections: TenantConnection[];
  createdAt?: string;
  updatedAt?: string;
}

export function buildMssqlConnectionString(config: {
  host?: string;
  server?: string;
  port?: number;
  database?: string;
  username?: string;
  user?: string;
  password?: string;
  encrypt?: boolean;
  trustServerCertificate?: boolean;
  connectionString?: string;
  dbType?: DbType;
}): string {
  if (!config) return '';
  if (config.connectionString && /Server=|Host=/i.test(config.connectionString)) {
    return config.connectionString;
  }
  const host = config.host || config.server || '';
  const port = config.port ?? 1433;
  const database = config.database || '';
  const user = config.username || config.user || '';
  const password = config.password || '';
  const encrypt = config.encrypt !== false;
  const trust = config.trustServerCertificate !== false;
  if (!host) return '';

  const dbType = config.dbType || 'mssql';
  if (dbType === 'postgresql') {
    return `Host=${host};Port=${port};Database=${database};Username=${user};Password=${password};`;
  }
  if (dbType === 'mysql') {
    return `Server=${host};Port=${port};Database=${database};Uid=${user};Pwd=${password};`;
  }
  return [
    `Server=${host},${port}`,
    `Database=${database}`,
    `User Id=${user}`,
    `Password=${password}`,
    `Encrypt=${encrypt}`,
    `TrustServerCertificate=${trust}`,
  ].join(';') + ';';
}

export type CompanyFormInput = {
  slug: string;
  name: string;
} & CompanyProfile & {
  connLabel?: string;
  dbType?: DbType;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  encrypt?: boolean;
  trustServerCertificate?: boolean;
};

export function hasPrimaryConnection(tenant: TenantConfig | null | undefined): boolean {
  if (!tenant?.connections?.length) return false;
  const primary = tenant.connections.find((c) => c.isPrimary) ?? tenant.connections[0];
  return !!(primary && primary.host && primary.database);
}

/** Slug for URL segment (db label or database name) */
export function slugifySegment(s: string): string {
  return (s || 'db')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'db';
}

export function getConnectionForEndpoint(
  tenant: TenantConfig | null | undefined,
  endpoint: EndpointConfig
): TenantConnection | null {
  if (!tenant?.connections?.length) return null;
  if (endpoint.connectionId) {
    return tenant.connections.find((c) => c.id === endpoint.connectionId) ?? null;
  }
  return tenant.connections.find((c) => c.isPrimary) ?? tenant.connections[0] ?? null;
}
