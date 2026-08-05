import sql from 'mssql';

export interface MssqlConnectInput {
  host: string;
  port?: number;
  database?: string;
  username: string;
  password: string;
  encrypt?: boolean;
  trustServerCertificate?: boolean;
}

export interface MssqlExecuteInput extends MssqlConnectInput {
  sqlQuery: string;
  /** Map of SQL param name (without @) → value */
  params?: Record<string, unknown>;
}

function toConfig(input: MssqlConnectInput, database?: string): sql.config {
  return {
    server: input.host,
    port: input.port && input.port > 0 ? input.port : 1433,
    database: database || input.database || 'master',
    user: input.username,
    password: input.password,
    options: {
      encrypt: input.encrypt !== false,
      trustServerCertificate: input.trustServerCertificate !== false,
      enableArithAbort: true,
      connectTimeout: 15000,
    },
    connectionTimeout: 15000,
    requestTimeout: 30000,
  };
}

export async function testMssqlConnection(
  input: MssqlConnectInput
): Promise<{ ok: true; serverVersion?: string } | { ok: false; message: string }> {
  let pool: sql.ConnectionPool | null = null;
  try {
    if (!input.host?.trim()) return { ok: false, message: 'Server (host) boş' };
    if (!input.username?.trim()) return { ok: false, message: 'Ulanyjy ady boş' };

    pool = await new sql.ConnectionPool(
      toConfig(input, input.database || 'master')
    ).connect();

    const r = await pool.request().query('SELECT @@VERSION AS v');
    const serverVersion = String(r.recordset?.[0]?.v || '').split('\n')[0]?.slice(0, 120);
    return { ok: true, serverVersion };
  } catch (err) {
    const message = (err as Error).message || String(err);
    return { ok: false, message };
  } finally {
    try {
      await pool?.close();
    } catch {
      /* ignore */
    }
  }
}

/** Connect to server (master) and list user databases */
export async function listMssqlDatabases(
  input: MssqlConnectInput
): Promise<{ ok: true; databases: string[] } | { ok: false; message: string }> {
  let pool: sql.ConnectionPool | null = null;
  try {
    if (!input.host?.trim()) return { ok: false, message: 'Server (host) boş' };
    if (!input.username?.trim()) return { ok: false, message: 'Ulanyjy ady boş' };

    pool = await new sql.ConnectionPool(toConfig(input, 'master')).connect();

    const r = await pool.request().query(`
      SELECT name
      FROM sys.databases
      WHERE state = 0
        AND name NOT IN ('master', 'tempdb', 'model', 'msdb')
      ORDER BY name
    `);
    const databases = (r.recordset || []).map((row: { name: string }) => row.name);
    return { ok: true, databases };
  } catch (err) {
    const message = (err as Error).message || String(err);
    return { ok: false, message };
  } finally {
    try {
      await pool?.close();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Execute a parameterized SQL query against the given connection.
 * Params keys should be WITHOUT leading @ (mssql adds binding itself).
 */
export async function executeMssqlQuery(
  input: MssqlExecuteInput
): Promise<
  | { ok: true; rows: Record<string, unknown>[]; rowCount: number; elapsedMs: number }
  | { ok: false; message: string }
> {
  let pool: sql.ConnectionPool | null = null;
  const t0 = Date.now();
  try {
    if (!input.host?.trim()) return { ok: false, message: 'Server (host) boş' };
    if (!input.username?.trim()) return { ok: false, message: 'Ulanyjy ady boş' };
    if (!input.sqlQuery?.trim()) return { ok: false, message: 'SQL sorag boş' };

    pool = await new sql.ConnectionPool(toConfig(input, input.database)).connect();
    const request = pool.request();

    if (input.params) {
      for (const [key, value] of Object.entries(input.params)) {
        const name = key.startsWith('@') ? key.slice(1) : key;
        // Let mssql infer type from JS value
        request.input(name, value as any);
      }
    }

    const result = await request.query(input.sqlQuery);
    const rows = (result.recordset || []) as Record<string, unknown>[];
    return {
      ok: true,
      rows,
      rowCount: rows.length,
      elapsedMs: Date.now() - t0,
    };
  } catch (err) {
    return {
      ok: false,
      message: (err as Error).message || String(err),
    };
  } finally {
    try {
      await pool?.close();
    } catch {
      /* ignore */
    }
  }
}
