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
    requestTimeout: 15000,
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

    // Always hit master first so we can list DBs even if target DB wrong
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
