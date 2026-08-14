import { app, BrowserWindow, ipcMain } from 'electron';
import crypto from 'node:crypto';
import * as localDb from './localDb';
import * as mssqlHelper from './mssqlHelper';

export interface TenantAgentStatus {
  tenantSlug: string;
  tenantName: string;
  online: boolean;
  lastConnectedAt?: string;
  lastError?: string;
  reconnectAttempts: number;
}

interface ActiveSocket {
  tenantSlug: string;
  socket: WebSocket;
  reconnectTimer?: NodeJS.Timeout;
}

class LocalAgentManager {
  private activeSockets = new Map<string, ActiveSocket>();
  private statuses = new Map<string, TenantAgentStatus>();
  private isRunning = false;
  private refreshTimer: NodeJS.Timeout | null = null;

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.syncConnections();

    // Check periodically for added/removed companies or settings changes
    this.refreshTimer = setInterval(() => {
      if (this.isRunning) this.syncConnections();
    }, 15_000);
  }

  public stop() {
    this.isRunning = false;
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    for (const [slug, item] of this.activeSockets.entries()) {
      if (item.reconnectTimer) clearTimeout(item.reconnectTimer);
      try {
        item.socket.close();
      } catch {
        /* ignore */
      }
    }
    this.activeSockets.clear();
  }

  public restart() {
    this.stop();
    this.start();
  }

  public getStatuses(): TenantAgentStatus[] {
    return Array.from(this.statuses.values());
  }

  private slugify(s: string) {
    return (s || 'primary')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'primary';
  }

  public syncConnections() {
    if (!this.isRunning) return;

    const settings = localDb.getSettings();
    const gatewayUrl = (settings.gatewayUrl || '').trim();
    const adminSecret = localDb.decryptSecret(settings.adminSecretEnc || '').trim();

    if (!gatewayUrl || !adminSecret) {
      // Cannot connect without VPS gateway settings
      return;
    }

    const companies = localDb.listCompanies();
    const activeSlugs = new Set<string>();

    for (const company of companies) {
      if (company.isActive === false) continue;
      const slug = (company.slug || '').trim();
      if (!slug) continue;

      activeSlugs.add(slug);

      if (!this.statuses.has(slug)) {
        this.statuses.set(slug, {
          tenantSlug: slug,
          tenantName: company.name,
          online: false,
          reconnectAttempts: 0,
        });
      }

      if (!this.activeSockets.has(slug)) {
        this.connectTenant(company, gatewayUrl, adminSecret);
      }
    }

    // Clean up sockets for removed or deactivated companies
    for (const [slug, item] of this.activeSockets.entries()) {
      if (!activeSlugs.has(slug)) {
        if (item.reconnectTimer) clearTimeout(item.reconnectTimer);
        try {
          item.socket.close();
        } catch {
          /* ignore */
        }
        this.activeSockets.delete(slug);
        this.statuses.delete(slug);
      }
    }
  }

  private connectTenant(company: localDb.CompanyRecord, gatewayUrl: string, adminSecret: string) {
    const slug = company.slug;
    const existing = this.activeSockets.get(slug);
    if (existing?.reconnectTimer) {
      clearTimeout(existing.reconnectTimer);
    }

    const wsBase = gatewayUrl
      .replace(/^https:\/\//i, 'wss://')
      .replace(/^http:\/\//i, 'ws://')
      .replace(/\/$/, '');

    const signature = crypto
      .createHmac('sha256', adminSecret)
      .update(slug)
      .digest('hex');

    const appVersion = app.isPackaged ? app.getVersion() : 'dev';
    const wsUrl = `${wsBase}/ws/agent?tenantSlug=${encodeURIComponent(slug)}&signature=${encodeURIComponent(signature)}&client=Electron_${encodeURIComponent(appVersion)}`;

    try {
      // Uses built-in Node/Electron WebSocket
      const ws = new WebSocket(wsUrl);

      const activeItem: ActiveSocket = {
        tenantSlug: slug,
        socket: ws,
      };
      this.activeSockets.set(slug, activeItem);

      ws.onopen = () => {
        const st = this.statuses.get(slug) || {
          tenantSlug: slug,
          tenantName: company.name,
          online: true,
          reconnectAttempts: 0,
        };
        st.online = true;
        st.lastConnectedAt = new Date().toISOString();
        st.lastError = undefined;
        st.reconnectAttempts = 0;
        this.statuses.set(slug, st);
        this.broadcastStatus();
        console.log(`[LocalAgent] 🟢 Connected to VPS WebSocket tunnel for company "${slug}"`);
      };

      ws.onmessage = async (event: MessageEvent) => {
        try {
          const raw = typeof event.data === 'string' ? event.data : event.data?.toString?.('utf8');
          if (!raw) return;
          const msg = JSON.parse(raw);

          if (msg.type === 'PING') {
            ws.send(JSON.stringify({ type: 'PONG', timestamp: new Date().toISOString() }));
            return;
          }

          if (msg.type === 'EXECUTE_QUERY' && msg.requestId) {
            await this.handleExecuteQuery(ws, company, msg);
          }
        } catch (err) {
          console.warn(`[LocalAgent] Error handling message for "${slug}":`, err);
        }
      };

      ws.onclose = () => {
        this.handleDisconnect(company, gatewayUrl, adminSecret);
      };

      ws.onerror = (evt: Event) => {
        const st = this.statuses.get(slug);
        if (st) {
          st.lastError = 'WebSocket connection error';
        }
      };
    } catch (err) {
      console.warn(`[LocalAgent] Failed to initiate WebSocket for "${slug}":`, err);
      this.handleDisconnect(company, gatewayUrl, adminSecret);
    }
  }

  private handleDisconnect(company: localDb.CompanyRecord, gatewayUrl: string, adminSecret: string) {
    const slug = company.slug;
    const st = this.statuses.get(slug) || {
      tenantSlug: slug,
      tenantName: company.name,
      online: false,
      reconnectAttempts: 0,
    };
    st.online = false;
    st.reconnectAttempts = (st.reconnectAttempts || 0) + 1;
    this.statuses.set(slug, st);
    this.broadcastStatus();

    this.activeSockets.delete(slug);

    if (!this.isRunning) return;

    // Exponential backoff reconnect: 3s -> 6s -> 10s max
    const delay = Math.min(10_000, 2_000 + st.reconnectAttempts * 1_500);
    const timer = setTimeout(() => {
      if (this.isRunning) {
        this.connectTenant(company, gatewayUrl, adminSecret);
      }
    }, delay);

    this.activeSockets.set(slug, {
      tenantSlug: slug,
      socket: null as any,
      reconnectTimer: timer,
    });
  }

  private async handleExecuteQuery(ws: WebSocket, company: localDb.CompanyRecord, msg: any) {
    const { requestId, dbKey, sqlQuery, params } = msg;

    try {
      const connections = localDb.listConnections(company.id);
      if (!connections || connections.length === 0) {
        ws.send(
          JSON.stringify({
            type: 'QUERY_RESULT',
            requestId,
            ok: false,
            error: `Kompaniýa ("${company.name}") üçin ýerli MSSQL baglanyşygy goşulmadyk.`,
          })
        );
        return;
      }

      // Find target connection by dbKey or primary
      let targetConn = connections.find((c) => this.slugify(c.label || c.database || 'primary') === dbKey);
      if (!targetConn) {
        targetConn = connections.find((c) => c.isPrimary) || connections[0];
      }

      const plainPassword = localDb.decryptSecret(targetConn.passwordEnc || '');

      const execResult = await mssqlHelper.executeMssqlQuery({
        host: targetConn.host,
        port: targetConn.port,
        database: targetConn.database,
        username: targetConn.username,
        password: plainPassword,
        encrypt: targetConn.encrypt,
        trustServerCertificate: targetConn.trustServerCertificate,
        sqlQuery,
        params,
      });

      if (execResult.ok) {
        ws.send(
          JSON.stringify({
            type: 'QUERY_RESULT',
            requestId,
            ok: true,
            rows: execResult.rows,
            rowCount: execResult.rowCount,
            elapsedMs: execResult.elapsedMs,
          })
        );
      } else {
        ws.send(
          JSON.stringify({
            type: 'QUERY_RESULT',
            requestId,
            ok: false,
            error: execResult.message || 'MSSQL query error',
          })
        );
      }
    } catch (err) {
      ws.send(
        JSON.stringify({
          type: 'QUERY_RESULT',
          requestId,
          ok: false,
          error: (err as Error).message || String(err),
        })
      );
    }
  }

  private broadcastStatus() {
    const list = this.getStatuses();
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('agent:statusChanged', list);
      }
    }
  }
}

export const localAgentManager = new LocalAgentManager();

export function initLocalAgentIpc() {
  ipcMain.handle('agent:getStatuses', () => localAgentManager.getStatuses());
  ipcMain.handle('agent:restart', () => {
    localAgentManager.restart();
    return true;
  });
}
