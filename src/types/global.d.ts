export {};

declare global {
  interface Window {
    vaultAPI: {
      set: (key: string, value: string) => Promise<boolean>;
      get: (key: string) => Promise<string | null>;
      delete: (key: string) => Promise<boolean>;
    };
    cryptoAPI: {
      signPayload: (payload: unknown, secret: string) => Promise<string>;
    };
    staffAPI: {
      hashPassword: (plain: string) => Promise<string>;
      encryptSecret: (plain: string) => Promise<string>;
      decryptSecret: (enc: string) => Promise<string>;
      verifyPassword: (plain: string, stored: string) => Promise<boolean>;
    };
    updaterAPI: {
      check: () => Promise<{ ok?: boolean; version?: string; message?: string } | unknown>;
      download: () => Promise<unknown>;
      install: () => Promise<unknown>;
      setFeedUrl: (url: string) => Promise<{ ok: boolean; message?: string }>;
      getFeedUrl: () => Promise<string>;
      onAvailable: (cb: (info: { version: string; releaseNotes?: string; releaseDate?: string }) => void) => void;
      onProgress: (cb: (p: { percent: number; bytesPerSecond?: number; transferred?: number; total?: number }) => void) => void;
      onDownloaded: (cb: (info: { version: string; releaseNotes?: string }) => void) => void;
      onError: (cb: (e: { message: string }) => void) => void;
    };
    appAPI: {
      getVersion: () => Promise<string>;
    };
    appLockAPI: {
      hasPassword: () => Promise<boolean>;
      setPassword: (plain: string) => Promise<boolean>;
      clearPassword: () => Promise<boolean>;
      verify: (plain: string) => Promise<boolean>;
    };
    trayAPI: {
      setStatus: (status: 'ok' | 'partial' | 'offline') => Promise<boolean>;
    };
    windowAPI: {
      minimize: () => Promise<void>;
      maximizeToggle: () => Promise<void>;
      hide: () => Promise<void>;
      restartApp: () => Promise<void>;
      quitApp: () => Promise<void>;
    };
    mssqlAPI: {
      testConnection: (input: {
        host: string;
        port?: number;
        database?: string;
        username: string;
        password: string;
        encrypt?: boolean;
        trustServerCertificate?: boolean;
      }) => Promise<{ ok: true; serverVersion?: string } | { ok: false; message: string }>;
      listDatabases: (input: {
        host: string;
        port?: number;
        database?: string;
        username: string;
        password: string;
        encrypt?: boolean;
        trustServerCertificate?: boolean;
      }) => Promise<{ ok: true; databases: string[] } | { ok: false; message: string }>;
      executeQuery: (input: {
        host: string;
        port?: number;
        database?: string;
        username: string;
        password: string;
        encrypt?: boolean;
        trustServerCertificate?: boolean;
        sqlQuery: string;
        params?: Record<string, unknown>;
      }) => Promise<
        | { ok: true; rows: Record<string, unknown>[]; rowCount: number; elapsedMs: number }
        | { ok: false; message: string }
      >;
    };
    dbAPI: {
      exportSnapshot: () => Promise<{
        companies: Array<Record<string, unknown>>;
        connections: Array<Record<string, unknown>>;
        staff: Array<Record<string, unknown>>;
        endpoints: Array<Record<string, unknown>>;
        settings: { gatewayUrl: string; adminSecret: string };
      }>;
      upsertCompany: (company: unknown) => Promise<unknown>;
      deleteCompany: (id: string) => Promise<boolean>;
      upsertConnection: (conn: unknown) => Promise<unknown>;
      deleteConnection: (id: string) => Promise<boolean>;
      upsertStaff: (member: unknown) => Promise<unknown>;
      deleteStaff: (id: string) => Promise<boolean>;
      upsertEndpoint: (ep: unknown) => Promise<unknown>;
      deleteEndpoint: (id: string) => Promise<boolean>;
      getSettings: () => Promise<{ gatewayUrl: string; adminSecret: string }>;
      updateSettings: (patch: {
        gatewayUrl?: string;
        adminSecret?: string;
      }) => Promise<{ gatewayUrl: string; adminSecret: string }>;
      listSyncQueue: () => Promise<
        Array<{
          id: string;
          type: string;
          tenantSlug?: string;
          attempts: number;
          lastError?: string;
          status: string;
          createdAt: string;
          updatedAt: string;
        }>
      >;
      enqueueSync: (item: {
        type: string;
        tenantSlug?: string;
        payload?: unknown;
        id?: string;
      }) => Promise<unknown>;
      updateSyncQueueItem: (id: string, patch: unknown) => Promise<unknown>;
      removeSyncQueueItem: (id: string) => Promise<boolean>;
      getSyncMeta: () => Promise<{
        lastSuccessAt?: string;
        lastAttemptAt?: string;
        lastError?: string;
        lastResult?: string;
        autoSyncIntervalSec: number;
      }>;
      updateSyncMeta: (patch: unknown) => Promise<unknown>;
    };
  }
}
