import os from 'node:os';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import http from 'node:http';
import https from 'node:https';

export interface DeviceProfile {
  id: string;
  token: string;
  name: string;
  hostname: string;
  osPlatform: string;
  osRelease: string;
  ramGb: number;
  cpuModel: string;
  macAddress: string;
  ipAddress: string;
  status: 'pending' | 'approved' | 'blocked' | 'offline';
  tenantId?: string;
  tenantSlug?: string;
  tenantSlugs?: string[];
  companyName?: string;
  companyNames?: string[];
  companySlugs?: string[];
  deviceSyncSecret?: string;
  appVersion: string;
}

export function nodeFetch(url: string, init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal }): Promise<{ ok: boolean; status: number; json: () => Promise<any>; text: () => Promise<string> }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const transport = parsed.protocol === 'https:' ? https : http;

    const req = transport.request(
      url,
      {
        method: init.method,
        headers: init.headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk as Buffer));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf-8');
          resolve({
            ok: res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode || 0,
            text: async () => body,
            json: async () => JSON.parse(body),
          });
        });
      }
    );

    req.on('error', (err) => reject(err));

    if (init.signal) {
      init.signal.addEventListener(
        'abort',
        () => {
          req.destroy();
          reject(new Error('Aborted'));
        },
        { once: true }
      );
    }

    if (init.body) {
      req.write(init.body);
    }
    req.end();
  });
}

function getPrimaryMacAndIp(): { mac: string; ip: string } {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    const netList = nets[name];
    if (!netList) continue;
    for (const net of netList) {
      if (!net.internal && net.family === 'IPv4') {
        return { mac: net.mac || '', ip: net.address || '' };
      }
    }
  }
  return { mac: '00:00:00:00:00:00', ip: '127.0.0.1' };
}

function getDeviceStorePath(): string {
  return path.join(app.getPath('userData'), 'device-profile.json');
}

export function loadOrGenerateDeviceProfile(): DeviceProfile {
  const filePath = getDeviceStorePath();
  const { mac, ip } = getPrimaryMacAndIp();
  const hostname = os.hostname();
  const osPlatform = os.platform();
  const osRelease = os.release();
  const ramGb = Math.round((os.totalmem() / (1024 * 1024 * 1024)) * 10) / 10;
  const cpuModel = os.cpus()[0]?.model || 'Standard CPU';
  const appVersion = app.getVersion() || '1.0.0';

  let stored: Partial<DeviceProfile> = {};
  if (fs.existsSync(filePath)) {
    try {
      stored = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      stored = {};
    }
  }

  // Deterministic hardware seed based on system parameters
  if (!stored.id) {
    const rawHardwareString = `${hostname}|${osPlatform}|${os.arch()}|${cpuModel}|${mac}|${os.totalmem()}`;
    const hash = crypto.createHash('sha256').update(rawHardwareString).digest('hex');
    stored.id = `dev_${hash.slice(0, 16)}`;
  }

  if (!stored.token) {
    stored.token = crypto.randomBytes(24).toString('hex');
  }

  if (!stored.deviceSyncSecret) {
    stored.deviceSyncSecret = crypto.randomBytes(32).toString('hex');
  }

  const profile: DeviceProfile = {
    id: stored.id,
    token: stored.token,
    name: stored.name || hostname,
    hostname,
    osPlatform,
    osRelease,
    ramGb,
    cpuModel,
    macAddress: mac,
    ipAddress: ip,
    status: stored.status || 'pending',
    tenantId: stored.tenantId,
    tenantSlug: stored.tenantSlug,
    tenantSlugs: stored.tenantSlugs,
    companyName: stored.companyName,
    companyNames: stored.companyNames,
    companySlugs: stored.companySlugs,
    deviceSyncSecret: stored.deviceSyncSecret,
    appVersion,
  };

  saveDeviceProfile(profile);
  return profile;
}

export function saveDeviceProfile(profile: Partial<DeviceProfile>): DeviceProfile {
  const filePath = getDeviceStorePath();
  let current: Partial<DeviceProfile> = {};
  if (fs.existsSync(filePath)) {
    try {
      current = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      current = {};
    }
  }
  const merged = { ...current, ...profile } as DeviceProfile;
  fs.writeFileSync(filePath, JSON.stringify(merged, null, 2), 'utf8');
  return merged;
}

export async function registerDeviceWithGateway(
  gatewayUrl: string,
  _adminSecret?: string
): Promise<{ ok: boolean; profile?: DeviceProfile; error?: string }> {
  const current = loadOrGenerateDeviceProfile();
  if (!gatewayUrl) return { ok: false, error: 'Gateway URL sazlanmadyk' };

  const url = `${gatewayUrl.replace(/\/$/, '')}/api/admin/devices/register`;
  const body = {
    id: current.id,
    token: current.token,
    name: current.name,
    hostname: current.hostname,
    osPlatform: current.osPlatform,
    osRelease: current.osRelease,
    ramGb: current.ramGb,
    cpuModel: current.cpuModel,
    macAddress: current.macAddress,
    ipAddress: current.ipAddress,
    appVersion: current.appVersion,
    deviceSyncSecret: current.deviceSyncSecret,
  };

  const bodyStr = JSON.stringify(body);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await nodeFetch(url, {
      method: 'POST',
      headers,
      body: bodyStr,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      let respBody: any = {};
      try {
        const text = await res.text();
        try { respBody = JSON.parse(text); } catch { respBody = { raw: text.slice(0, 200) }; }
      } catch { /* ignore */ }
      return {
        ok: false,
        error: `VPS Gateway error (${res.status}): ${respBody.error || respBody.raw}`,
        debug: { url, status: res.status, body: respBody },
      };
    }

     const data = (await res.json()) as any;
     const updated = saveDeviceProfile({
       status: data.status || 'pending',
       tenantId: data.tenantId || undefined,
       tenantSlug: data.tenantSlug || undefined,
       tenantSlugs: data.tenantSlugs || data.companySlugs || undefined,
       companyName: data.companyName || undefined,
       companyNames: data.companyNames || undefined,
       companySlugs: data.companySlugs || data.tenantSlugs || undefined,
       deviceSyncSecret: data.deviceSyncSecret || current.deviceSyncSecret || undefined,
       name: data.name || current.name,
     });

     return { ok: true, profile: updated };
   } catch (err: any) {
     return { ok: false, error: err?.message || 'VPS Gateway-e birigip bolmady', debug: { url } };
   }
 }

  export async function checkDeviceStatusWithGateway(
    gatewayUrl: string,
    _adminSecret?: string,
    _localDeviceSecret?: string
  ): Promise<{ ok: boolean; profile?: DeviceProfile; error?: string }> {
    const current = loadOrGenerateDeviceProfile();
    if (!gatewayUrl) return { ok: false, error: 'Gateway URL sazlanmadyk' };

    const qs = new URLSearchParams({
      deviceId: current.id,
      token: current.token,
    }).toString();

    const url = `${gatewayUrl.replace(/\/$/, '')}/api/admin/devices/status?${qs}`;
    const headers: Record<string, string> = {};

    const signingSecret = current.deviceSyncSecret || localDeviceSecret;
    if (signingSecret) {
      const sig = crypto.createHmac('sha256', signingSecret).update(JSON.stringify({ deviceId: current.id })).digest('hex');
      headers['x-device-sync-signature'] = sig;
      headers['x-device-id'] = current.id;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const res = await nodeFetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        if (res.status === 404 || res.status === 401) {
          return registerDeviceWithGateway(gatewayUrl);
        }
        if (res.status === 403) {
          const body = await res.json().catch(() => ({}));
          if (body?.status === 'rejected') {
            return { ok: false, error: 'Device secret mismatch. Re-approval required.', status: 'rejected' };
          }
        }
        return { ok: false, error: `VPS Gateway error (${res.status})` };
      }

       const data = (await res.json()) as any;

       if (current.deviceSyncSecret && data.deviceSyncSecret && data.deviceSyncSecret !== current.deviceSyncSecret) {
         return { ok: false, error: 'Device secret changed. Re-approval required.', status: 'rejected' };
       }

       const updated = saveDeviceProfile({
         status: data.status || 'pending',
         tenantId: data.tenantId || undefined,
         tenantSlug: data.tenantSlug || undefined,
         tenantSlugs: data.tenantSlugs || data.companySlugs || undefined,
         companyName: data.companyName || undefined,
         companyNames: data.companyNames || undefined,
         companySlugs: data.companySlugs || data.tenantSlugs || undefined,
         deviceSyncSecret: data.deviceSyncSecret || current.deviceSyncSecret || undefined,
         name: data.name || current.name,
       });

       return { ok: true, profile: updated };
     } catch (err: any) {
       return { ok: false, error: err?.message || 'VPS Gateway-e birigip bolmady' };
     }
   }

  export async function checkDevicePermission(
    gatewayUrl: string,
    _adminSecret?: string,
    localDeviceSecret?: string
  ): Promise<PermissionResult> {
    const current = loadOrGenerateDeviceProfile();
    if (!gatewayUrl) return { permissionGranted: false, reason: 'error', error: 'Gateway URL sazlanmadyk' };

    const qs = new URLSearchParams({
      deviceId: current.id,
      token: current.token,
    }).toString();

    const url = `${gatewayUrl.replace(/\/$/, '')}/api/admin/devices/status?${qs}`;
    const headers: Record<string, string> = {};

    const signingSecret = localDeviceSecret || current.deviceSyncSecret;
    if (signingSecret) {
      const sig = crypto.createHmac('sha256', signingSecret).update(JSON.stringify({ deviceId: current.id })).digest('hex');
      headers['x-device-sync-signature'] = sig;
      headers['x-device-id'] = current.id;
    }

   try {
     const controller = new AbortController();
     const timeout = setTimeout(() => controller.abort(), 6000);
     const res = await nodeFetch(url, {
       method: 'GET',
       headers,
       signal: controller.signal,
     });
     clearTimeout(timeout);

     if (!res.ok) {
       if (res.status === 404) {
         const updated = saveDeviceProfile({ status: 'blocked' });
         return { permissionGranted: false, reason: 'deleted', profile: updated, error: 'Enjam administrator tarapyndan pozuldy' };
       }
       if (res.status === 403) {
         const body = await res.json().catch(() => ({}));
         if (body?.status === 'rejected') {
           const updated = saveDeviceProfile({ status: 'pending' });
           return { permissionGranted: false, reason: 'rejected', profile: updated, error: 'Device secret changed. Re-approval required.' };
         }
       }
       return { permissionGranted: false, reason: 'error', error: `VPS Gateway error (${res.status})` };
     }

      const data = (await res.json()) as any;

      if (localDeviceSecret && data.deviceSyncSecret && data.deviceSyncSecret !== localDeviceSecret) {
        const updated = saveDeviceProfile({ status: 'pending' });
        return { permissionGranted: false, reason: 'rejected', profile: updated, error: 'Device secret changed. Re-approval required.' };
      }

      const updated = saveDeviceProfile({
        status: data.status || 'pending',
        tenantId: data.tenantId || undefined,
        tenantSlug: data.tenantSlug || undefined,
        tenantSlugs: data.tenantSlugs || data.companySlugs || undefined,
        companyName: data.companyName || undefined,
        companyNames: data.companyNames || undefined,
        companySlugs: data.companySlugs || data.tenantSlugs || undefined,
        deviceSyncSecret: data.deviceSyncSecret || localDeviceSecret || undefined,
        name: data.name || current.name,
      });

      if (data.status === 'blocked') {
        return { permissionGranted: false, reason: 'blocked', profile: updated };
      }

      if (data.status === 'approved') {
        return { permissionGranted: true, reason: 'ok', profile: updated };
      }

      return { permissionGranted: false, reason: 'error', profile: updated, error: `Status: ${data.status}` };
    } catch (err: any) {
      return { permissionGranted: false, reason: 'error', error: err?.message || 'VPS Gateway-e birigip bolmady' };
    }
  }
