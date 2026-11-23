import type {
  CorsOptions,
  CorsOptionsDelegate,
} from '@nestjs/common/interfaces/external/cors-options.interface';
import type { Request } from 'express';

/**
 * The OAuth routes a browser-based MCP client on any origin (MCP Inspector, a
 * web IDE) calls before it holds a token: discovery (RFC 9728, RFC 8414),
 * registration (RFC 7591), the token endpoint and revocation (RFC 7009), each
 * with the one method it serves. None of them reads a cookie: they are public,
 * skip CSRF and act only on what the body carries.
 */
const PUBLIC_OAUTH_ROUTES: ReadonlyMap<string, string> = new Map([
  ['/api/v1/oauth/protected-resource', 'GET'],
  ['/api/v1/oauth/authorization-server', 'GET'],
  ['/api/v1/oauth/register', 'POST'],
  ['/api/v1/oauth/token', 'POST'],
  ['/api/v1/oauth/revoke', 'POST'],
]);

/** A JSON registration body, and the version header MCP clients send on discovery. */
const PUBLIC_OAUTH_HEADERS = ['Content-Type', 'MCP-Protocol-Version'];

/**
 * CORS per request. The routes above answer any origin without credentials
 * (`*`, never `Access-Control-Allow-Credentials`, so a browser sends no cookie
 * it may read the answer of); every other route keeps the credentialed
 * allowlist of the app's own origins.
 */
export function corsOptionsFor(allowedOrigins: string[]): CorsOptionsDelegate<Request> {
  const credentialed: CorsOptions = {
    origin: allowedOrigins,
    credentials: true,
    // content-disposition: file downloads read the server's file name from it;
    // hidden from cross-origin JS, every export fell back to a generic name.
    exposedHeaders: ['x-request-id', 'x-trace-id', 'content-disposition'],
  };
  return (request, callback) => {
    const method = PUBLIC_OAUTH_ROUTES.get(request.path);
    callback(
      null,
      method
        ? {
            origin: '*',
            credentials: false,
            methods: [method],
            allowedHeaders: PUBLIC_OAUTH_HEADERS,
            maxAge: 600,
          }
        : credentialed,
    );
  };
}
