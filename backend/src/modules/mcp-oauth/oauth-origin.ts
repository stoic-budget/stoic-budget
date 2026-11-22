/** Where the MCP endpoint sits under the public origin (the frontend proxies /api). */
export const MCP_PATH = '/api/v1/mcp';
export const PROTECTED_RESOURCE_METADATA_PATH = '/.well-known/oauth-protected-resource';

/**
 * The public origin of this instance, from configuration only: never from a
 * request's Host header, which the caller controls. Null when unset, and then
 * OAuth stays off.
 */
export function publicOrigin(env: NodeJS.ProcessEnv = process.env): string | null {
  const raw = (env.APP_URL || env.FRONTEND_URL || '').split(',')[0].trim();
  if (!raw) {
    return null;
  }
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : null;
  } catch {
    return null;
  }
}

export const mcpResourceUrl = (origin: string): string => `${origin}${MCP_PATH}`;

/** RFC 9728 §3.1: the well-known path with the resource's own path appended. */
export const resourceMetadataUrl = (origin: string): string =>
  `${origin}${PROTECTED_RESOURCE_METADATA_PATH}${MCP_PATH}`;

/**
 * Whether `requested` names `resource` (RFC 8707): same scheme, host, port and
 * path, a trailing slash aside. A query or a fragment never matches.
 */
export function isSameResource(requested: string, resource: string): boolean {
  const canonical = (value: string): string | null => {
    try {
      const url = new URL(value);
      if (url.search || url.hash || value.includes('#')) return null;
      return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
    } catch {
      return null;
    }
  };
  const left = canonical(requested);
  return left !== null && left === canonical(resource);
}
