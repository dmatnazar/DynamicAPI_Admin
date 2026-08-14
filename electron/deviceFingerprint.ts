import os from 'node:os';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

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
  companyName?: string;
  appVersion: string;
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
    companyName: stored.companyName,
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
  adminSecret: string
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
  };

  const bodyStr = JSON.stringify(body);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (adminSecret) {
    const sig = crypto.createHmac('sha256', adminSecret).update(bodyStr).digest('hex');
    headers['x-admin-signature'] = sig;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: bodyStr,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return { ok: false, error: `VPS Gateway error (${res.status})` };
    }

    const data = (await res.json()) as any;
    const updated = saveDeviceProfile({
      status: data.status || 'pending',
      tenantId: data.tenantId || undefined,
      tenantSlug: data.tenantSlug || undefined,
      companyName: data.companyName || undefined,
      name: data.name || current.name,
    });

    return { ok: true, profile: updated };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'VPS Gateway-e birigip bolmady' };
  }
}

export async function checkDeviceStatusWithGateway(
  gatewayUrl: string,
  adminSecret: string
): Promise<{ ok: boolean; profile?: DeviceProfile; error?: string }> {
  const current = loadOrGenerateDeviceProfile();
  if (!gatewayUrl) return { ok: false, error: 'Gateway URL sazlanmadyk' };

  const qs = new URLSearchParams({
    deviceId: current.id,
    token: current.token,
  }).toString();

  const url = `${gatewayUrl.replace(/\/$/, '')}/api/admin/devices/status?${qs}`;
  const headers: Record<string, string> = {};
  if (adminSecret) {
    const sig = crypto.createHmac('sha256', adminSecret).update(qs).digest('hex');
    headers['x-admin-signature'] = sig;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      if (res.status === 404) {
        // Not found, re-register
        return registerDeviceWithGateway(gatewayUrl, adminSecret);
      }
      return { ok: false, error: `VPS Gateway error (${res.status})` };
    }

    const data = (await res.json()) as any;
    const updated = saveDeviceProfile({
      status: data.status || 'pending',
      tenantId: data.tenantId || undefined,
      tenantSlug: data.tenantSlug || undefined,
      companyName: data.companyName || undefined,
      name: data.name || current.name,
    });

    return { ok: true, profile: updated };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'VPS Gateway-e birigip bolmady' };
  }
}
