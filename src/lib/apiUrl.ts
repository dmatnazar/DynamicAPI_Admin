import type { EndpointConfig, TenantConfig } from '../types/endpoint.types';
import { getConnectionForEndpoint, slugifySegment } from '../types/endpoint.types';

/**
 * Gateway route shape (must match vps-gateway dynamicRouter):
 *   /api/v1/:tenantSlug/:dbKey/*
 * Example:
 *   http://localhost:4000/api/v1/h/primary/test1
 */
export function buildApiUrl(
  gatewayUrl: string,
  tenant: TenantConfig | null | undefined,
  endpoint: EndpointConfig
): string {
  const base = (gatewayUrl || 'http://localhost:4000').replace(/\/$/, '');
  const companySlug = tenant?.slug?.trim();
  if (!companySlug) {
    return `${base}/api/v1/…/…${normalizePath(endpoint.pathTemplate)}`;
  }

  const conn = getConnectionForEndpoint(tenant, endpoint);
  const dbKey = slugifySegment(conn?.label || conn?.database || 'primary');

  return `${base}/api/v1/${companySlug}/${dbKey}${normalizePath(endpoint.pathTemplate)}`;
}

function normalizePath(path: string | undefined): string {
  let p = path || '/';
  if (!p.startsWith('/')) p = `/${p}`;
  return p;
}

export function describeApiTarget(
  tenant: TenantConfig | null | undefined,
  endpoint: EndpointConfig
): { company: string; database: string; path: string } {
  const conn = getConnectionForEndpoint(tenant, endpoint);
  return {
    company: tenant?.name || tenant?.slug || '—',
    database: conn ? `${conn.label} (${conn.database})` : '—',
    path: normalizePath(endpoint.pathTemplate),
  };
}

export function buildExampleApiUrl(
  gatewayUrl: string,
  tenant: TenantConfig | null | undefined,
  endpoint: EndpointConfig,
  sampleValues?: Record<string, string>
): string {
  const url = buildApiUrl(gatewayUrl, tenant, endpoint);
  return url.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (_, name) => {
    return encodeURIComponent(sampleValues?.[name] ?? `{${name}}`);
  });
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }
}
