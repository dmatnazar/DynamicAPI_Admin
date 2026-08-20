import { app, BrowserWindow, ipcMain, safeStorage } from 'electron';
import WebSocket from 'ws';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
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
  socket: WebSocket | null;
  reconnectTimer?: NodeJS.Timeout;
}

/**
 * Electron → VPS: only Gateway URL is required here.
 * Signing uses device_sync_secret from device profile (NOT ADMIN_SYNC_SECRET).
 */
function getGatewayUrl(): string | null {
  try {
    const s = localDb.getSettings();
    const gUrl = (s.gatewayUrl || '').trim();
    if (gUrl) return gUrl;
  } catch { /* ignore */ }

  try {
    const vaultPath = path.join(app.getPath('userData'), 'vault.json');
    if (fs.existsSync(vaultPath)) {
      const data = JSON.parse(fs.readFileSync(vaultPath, 'utf8'));
      let gatewayUrl = data.gatewayUrl || '';
      if (safeStorage.isEncryptionAvailable() && gatewayUrl && !gatewayUrl.startsWith('http')) {
        try {
          gatewayUrl = safeStorage.decryptString(Buffer.from(gatewayUrl, 'base64'));
        } catch { /* ignore */ }
      }
      if (gatewayUrl) return gatewayUrl.trim();
    }
  } catch { /* ignore */ }

  return null;
}

function getCredentials(): { gatewayUrl: string; adminSecret: string } | null {
  const gatewayUrl = getGatewayUrl();
  if (!gatewayUrl) return null;
  return { gatewayUrl, adminSecret: '' };
}

import {
  loadOrGenerateDeviceProfile,
  saveDeviceProfile,
  checkDeviceStatusWithGateway,
  type DeviceProfile,
} from './deviceFingerprint';

// ── Real-time device event listener ──────────────────────────────────────
// Receives approve/block/delete pushes from VPS gateway in real-time.
class DeviceEventsClient {
  private socket: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private reconnectAttempts = 0;

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.connect();
  }

  public stop() {
    this.isRunning = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    try {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.close();
      }
    } catch {
      /* ignore */
    }
    this.socket = null;
  }

  public restart() {
    this.stop();
    this.start();
  }

  private connect() {
    if (!this.isRunning) return;

    const creds = getCredentials();
    if (!creds || !creds.gatewayUrl) {
      // Retry later — settings may be configured after startup
      this.scheduleReconnect('');
      return;
    }

    const profile = loadOrGenerateDeviceProfile();
    if (!profile.id) return;

    const wsBase = creds.gatewayUrl
      .replace(/^https:\/\//i, 'wss://')
      .replace(/^http:\/\//i, 'ws://')
      .replace(/\/$/, '');

    const deviceSecret = profile.deviceSyncSecret || profile.token || '';
    const signature = crypto
      .createHmac('sha256', deviceSecret)
      .update(JSON.stringify({ deviceId: profile.id }))
      .digest('hex');

    const wsUrl = `${wsBase}/ws/device-events?deviceId=${encodeURIComponent(profile.id)}&deviceSignature=${encodeURIComponent(signature)}`;

    console.log(`[DeviceEventsClient] 🔄 Connecting to device events WebSocket...`);

    try {
      const ws = new WebSocket(wsUrl, {
        headers: {
          'X-Device-Sync-Signature': signature,
          'X-Device-Id': profile.id,
        },
        rejectUnauthorized: false,
      });
      this.socket = ws;

      ws.on('open', () => {
        this.reconnectAttempts = 0;
        console.log('[DeviceEventsClient] 🟢 Connected to device events WebSocket');
      });

      ws.on('message', (data: WebSocket.RawData) => {
        try {
          const raw = data.toString('utf8');
          if (!raw) return;
          const msg = JSON.parse(raw);

          if (msg.type === 'PING') {
            ws.send(JSON.stringify({ type: 'PONG', timestamp: new Date().toISOString() }));
            return;
          }

          if (msg.event === 'DEVICE_EVENT' && msg.type) {
            console.log('[DeviceEventsClient] 📡 Received device event:', msg.type, msg.deviceId);

            // Notify all windows — renderer reacts (auto-navigate, blocked screen, etc.)
            for (const win of BrowserWindow.getAllWindows()) {
              if (!win.isDestroyed()) {
                win.webContents.send('device:event', msg);
              }
            }

            // Immediately re-check device status from VPS for fresh state
            void this.syncDeviceStatusFromVps(creds.gatewayUrl);
          }
        } catch (err) {
          console.warn('[DeviceEventsClient] Failed to parse message:', err);
        }
      });

      ws.on('close', (code, reason) => {
        console.warn(`[DeviceEventsClient] 🔴 Device events socket closed (${code}: ${reason?.toString() || 'none'})`);
        this.socket = null;
        this.scheduleReconnect(creds.gatewayUrl);
      });

      ws.on('error', (err: Error) => {
        console.warn(`[DeviceEventsClient] ⚠️ Device events socket error:`, err.message);
        this.socket = null;
        this.scheduleReconnect(creds.gatewayUrl);
      });
    } catch (err) {
      console.warn('[DeviceEventsClient] Failed to connect:', err);
      this.scheduleReconnect(creds.gatewayUrl);
    }
  }

  private scheduleReconnect(gatewayUrl: string) {
    if (!this.isRunning) return;
    if (this.reconnectTimer) return;
    const delay = Math.min(15_000, 2_000 + this.reconnectAttempts * 2_000);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private async syncDeviceStatusFromVps(gatewayUrl: string) {
    try {
      const result = await checkDeviceStatusWithGateway(gatewayUrl);
      if (result.ok && result.profile) {
        for (const win of BrowserWindow.getAllWindows()) {
          if (!win.isDestroyed()) {
            win.webContents.send('device:statusChanged', result.profile);
          }
        }
      }
    } catch {
      /* ignore */
    }
  }
}

class LocalAgentManager {
  private activeSockets = new Map<string, ActiveSocket>();
  private statuses = new Map<string, TenantAgentStatus>();
  private isRunning = false;
  private refreshTimer: NodeJS.Timeout | null = null;
  private lastCredWarning = 0;
  private lastVpsStatusCheck = 0;

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[LocalAgent] 🚀 Starting Local Agent Tunnel Manager...');
    this.syncConnections();

    // Check periodically for added/removed companies or settings changes
    this.refreshTimer = setInterval(() => {
      if (this.isRunning) this.syncConnections();
    }, 10_000);
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
        if (item.socket && item.socket.readyState === WebSocket.OPEN) {
          item.socket.close();
        }
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

    // Check device approval status from local profile first (fast path)
    const dev = loadOrGenerateDeviceProfile();
    console.log(`[LocalAgent] syncConnections - device status: "${dev.status}"`);
    if (dev.status !== 'approved') {
      console.log(`[LocalAgent] ⏳ Device (${dev.id}) status is "${dev.status}". Tunnel waiting for admin confirmation.`);
      return;
    }

    const creds = getCredentials();
    if (!creds || !creds.gatewayUrl) {
      const now = Date.now();
      if (now - this.lastCredWarning > 30_000) {
        console.log('[LocalAgent] ⚠️ Gateway credentials not configured yet in Electron Settings.');
        this.lastCredWarning = now;
      }
      return;
    }

    // Periodically verify device status with VPS gateway (every 30s)
    const now = Date.now();
    if (now - this.lastVpsStatusCheck > 30_000) {
      this.lastVpsStatusCheck = now;
      console.log(`[LocalAgent] 🔍 Checking device status with VPS...`);
      void this.verifyDeviceStatusWithVps(creds.gatewayUrl, creds.adminSecret);
    }

    const { gatewayUrl, adminSecret } = creds;
    const companies = localDb.listCompanies();

    // ⚠️ Diňe device-e baglanan (assigned) kompaniýalar üçin tunnel açylýar.
    // Başga kompaniýalar üçin sync işlemeýär — ulanyjy talaby.
    const assignedSlugs = new Set<string>();
    const devSlugs = dev.companySlugs || dev.tenantSlugs || [];
    devSlugs.forEach((s) => assignedSlugs.add(s));

    const activeSlugs = new Set<string>();

    for (const company of companies) {
      if (company.isActive === false) continue;
      const slug = (company.slug || '').trim();
      if (!slug) continue;

      // Diňe assigned slug-lara degişli kompaniýalary sync et
      if (assignedSlugs.size > 0 && !assignedSlugs.has(slug)) {
        console.log(`[LocalAgent] ⏭️ "${slug}" device-e baglanmadyk — tunnel açylmaýar (assigned: ${[...assignedSlugs].join(', ')})`);
        continue;
      }

      activeSlugs.add(slug);

      if (!this.statuses.has(slug)) {
        this.statuses.set(slug, {
          tenantSlug: slug,
          tenantName: company.name,
          online: false,
          reconnectAttempts: 0,
        });
      }

      const existing = this.activeSockets.get(slug);
      if (!existing || (!existing.socket && !existing.reconnectTimer)) {
        this.connectTenant(company, gatewayUrl, adminSecret);
      }
    }

    // Clean up sockets for removed or deactivated companies
    for (const [slug, item] of this.activeSockets.entries()) {
      if (!activeSlugs.has(slug)) {
        if (item.reconnectTimer) clearTimeout(item.reconnectTimer);
        try {
          if (item.socket) item.socket.close();
        } catch {
          /* ignore */
        }
        this.activeSockets.delete(slug);
        this.statuses.delete(slug);
      }
    }
  }

  private async verifyDeviceStatusWithVps(gatewayUrl: string, _adminSecret: string) {
    try {
      const result = await checkDeviceStatusWithGateway(gatewayUrl);
      if (result.ok && result.profile) {
        const vpsStatus = result.profile.status;
        const localProfile = loadOrGenerateDeviceProfile();
        if (localProfile.status !== vpsStatus) {
          console.log(`[LocalAgent] 🔄 Device status changed in VPS: "${localProfile.status}" -> "${vpsStatus}". Updating local profile.`);
          const updated = saveDeviceProfile({ status: vpsStatus });
          this.notifyDeviceStatusChanged(updated);
        }
      }
    } catch {
      /* ignore background verification errors */
    }
  }

  private notifyDeviceStatusChanged(profile: DeviceProfile) {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('device:statusChanged', profile);
      }
    }
  }

  private connectTenant(company: localDb.CompanyRecord, gatewayUrl: string, adminSecret: string) {
    const slug = company.slug;
    const existing = this.activeSockets.get(slug);
    if (existing?.reconnectTimer) {
      clearTimeout(existing.reconnectTimer);
    }

    const profile = loadOrGenerateDeviceProfile();
    const deviceSecret = profile.deviceSyncSecret || profile.token || '';
    if (!deviceSecret) {
      console.error(`[LocalAgent] ❌ No deviceSyncSecret for tunnel "${slug}". Device must be approved on BI first.`);
      const st = this.statuses.get(slug) || {
        tenantSlug: slug,
        tenantName: company.name,
        online: false,
        reconnectAttempts: 0,
      };
      st.online = false;
      st.lastError = 'deviceSyncSecret missing — approve device on BI';
      this.statuses.set(slug, st);
      this.broadcastStatus();
      return;
    }
    if (profile.status !== 'approved') {
      console.error(`[LocalAgent] ❌ Device status is "${profile.status}" — tunnel skipped for "${slug}"`);
      return;
    }

    const wsBase = gatewayUrl
      .replace(/^https:\/\//i, 'wss://')
      .replace(/^http:\/\//i, 'ws://')
      .replace(/\/$/, '');

    const signature = crypto
      .createHmac('sha256', deviceSecret)
      .update(JSON.stringify({ deviceId: profile.id }))
      .digest('hex');

    const appVersion = app.isPackaged ? app.getVersion() : 'dev';
    const wsUrl = `${wsBase}/ws/agent?tenantSlug=${encodeURIComponent(slug)}&deviceId=${encodeURIComponent(profile.id)}&deviceSignature=${encodeURIComponent(signature)}&client=Electron_${encodeURIComponent(appVersion)}`;

    console.log(`[LocalAgent] 🔄 Connecting WebSocket tunnel for "${slug}" → ${wsUrl.replace(/signature=.*/, 'signature=***')}`);

    try {
      const ws = new WebSocket(wsUrl, {
        headers: {
          'X-Device-Sync-Signature': signature,
          'X-Device-Id': profile.id,
          'User-Agent': `Electron-LocalAgent/${appVersion}`,
        },
        rejectUnauthorized: false, // allow self-signed / IP certs in dev/LAN
      });

      const activeItem: ActiveSocket = {
        tenantSlug: slug,
        socket: ws,
      };
      this.activeSockets.set(slug, activeItem);

      ws.on('open', () => {
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
        console.log(`[LocalAgent] 🟢 Tunnel CONNECTED for company "${slug}" (${company.name})`);
      });

      ws.on('message', async (data: WebSocket.RawData) => {
        try {
          const raw = data.toString('utf8');
          if (!raw) return;
          const msg = JSON.parse(raw);

          if (msg.type === 'PING') {
            ws.send(JSON.stringify({ type: 'PONG', timestamp: new Date().toISOString() }));
            return;
          }

          if (msg.type === 'EXECUTE_QUERY' && msg.requestId) {
            console.log(`[LocalAgent] 📥 Executing query [${msg.requestId}] on local MSSQL for "${slug}"`);
            await this.handleExecuteQuery(ws, company, msg);
          }
        } catch (err) {
          console.warn(`[LocalAgent] Error handling message for "${slug}":`, err);
        }
      });

      ws.on('close', (code, reason) => {
        console.warn(`[LocalAgent] 🔴 Tunnel closed for "${slug}" (code: ${code}, reason: ${reason?.toString() || 'none'})`);
        this.handleDisconnect(company, gatewayUrl, adminSecret, reason?.toString());
      });

      ws.on('error', (err: Error) => {
        console.warn(`[LocalAgent] ⚠️ WebSocket error for "${slug}":`, err.message);
        const st = this.statuses.get(slug);
        if (st) {
          st.lastError = err.message;
        }
      });
    } catch (err) {
      console.warn(`[LocalAgent] Failed to initiate WebSocket for "${slug}":`, err);
      this.handleDisconnect(company, gatewayUrl, adminSecret, (err as Error).message);
    }
  }

  private handleDisconnect(company: localDb.CompanyRecord, gatewayUrl: string, adminSecret: string, errorMsg?: string) {
    const slug = company.slug;
    const st = this.statuses.get(slug) || {
      tenantSlug: slug,
      tenantName: company.name,
      online: false,
      reconnectAttempts: 0,
    };
    st.online = false;
    st.reconnectAttempts = (st.reconnectAttempts || 0) + 1;
    if (errorMsg) st.lastError = errorMsg;
    this.statuses.set(slug, st);
    this.broadcastStatus();

    this.activeSockets.delete(slug);

    if (!this.isRunning) return;

    // Exponential backoff reconnect: 3s -> 5s -> 10s max
    const delay = Math.min(10_000, 2_000 + st.reconnectAttempts * 1_500);
    const timer = setTimeout(() => {
      if (this.isRunning) {
        this.connectTenant(company, gatewayUrl, adminSecret);
      }
    }, delay);

    this.activeSockets.set(slug, {
      tenantSlug: slug,
      socket: null,
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
        console.log(`[LocalAgent] ✅ Query [${requestId}] success: ${execResult.rowCount} rows in ${execResult.elapsedMs}ms`);
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
        console.warn(`[LocalAgent] ❌ Query [${requestId}] failed on local MSSQL:`, execResult.message);
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
      console.warn(`[LocalAgent] ❌ Unexpected error executing query [${requestId}]:`, err);
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
export const deviceEventsClient = new DeviceEventsClient();

export function initLocalAgentIpc() {
  ipcMain.handle('agent:getStatuses', () => localAgentManager.getStatuses());
  ipcMain.handle('agent:restart', () => {
    localAgentManager.restart();
    deviceEventsClient.restart();
    return true;
  });
}