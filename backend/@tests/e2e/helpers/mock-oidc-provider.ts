import { createHash, createHmac, generateKeyPairSync, type KeyObject, sign } from 'node:crypto';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * An OpenID Connect provider for e2e tests: discovery, a JWKS from an RSA key
 * made here, and a token endpoint that checks the client, the redirect URI
 * and the PKCE verifier the way a real one does. A test plays the person at
 * the provider with `authorize`, choosing what the ID token says and how it
 * is signed, which is how the bad tokens are made.
 */
export interface TokenShape {
  /** RS256 with the current key (default), `none`, or HS256 keyed with the public key. */
  alg?: 'RS256' | 'none' | 'HS256-public';
  claims?: Record<string, unknown>;
  /** Claims to drop from the defaults. */
  omit?: string[];
}

interface Grant {
  challenge: string;
  redirectUri: string;
  idToken: string;
}

interface SigningKey {
  kid: string;
  privateKey: KeyObject;
  publicKey: KeyObject;
}

const newKey = (kid: string): SigningKey => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return { kid, privateKey, publicKey };
};

const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');

const readBody = (req: IncomingMessage): Promise<string> =>
  new Promise(resolve => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
    });
    req.on('end', () => resolve(body));
  });

export class MockOidcProvider {
  readonly clientId = 'stoic-client';
  /** A second provider in one test gets a secret of its own. */
  clientSecret = 'mock-client-secret-0123456789';
  issuer = '';
  /** What discovery says the issuer is; a test may point it elsewhere. */
  advertisedIssuer: string | null = null;
  jwksRequests = 0;
  tokenRequests = 0;
  /** The Authorization header of every token request, as sent. */
  readonly tokenAuthorizations: (string | null)[] = [];
  private key = newKey('key-1');
  private keyCount = 1;
  private readonly grants = new Map<string, Grant>();
  private server: Server | null = null;

  async start(): Promise<this> {
    this.server = createServer((req, res) => void this.handle(req, res));
    await new Promise<void>(resolve => this.server?.listen(0, '127.0.0.1', resolve));
    this.issuer = `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
    return this;
  }

  async close(): Promise<void> {
    await new Promise<void>(resolve => this.server?.close(() => resolve()));
  }

  /** A new signing key with a new kid; the old one leaves the key set. */
  rotateKey(): void {
    this.keyCount += 1;
    this.key = newKey(`key-${this.keyCount}`);
  }

  /**
   * The person signs in at the provider for the authorization request in
   * `location`; answers the code the provider would send back.
   */
  authorize(location: string, subject: string, shape: TokenShape = {}): string {
    const params = new URL(location).searchParams;
    const now = Math.floor(Date.now() / 1000);
    const claims: Record<string, unknown> = {
      iss: this.issuer,
      sub: subject,
      aud: this.clientId,
      exp: now + 300,
      iat: now,
      nonce: params.get('nonce'),
      email: `${subject}@example.com`,
      email_verified: true,
      name: 'Member One',
      // A provider asked for a new sign-in (max_age) says when it happened.
      ...(params.has('max_age') ? { auth_time: now } : {}),
      ...shape.claims,
    };
    for (const key of shape.omit ?? []) delete claims[key];
    const code = `code-${Math.random().toString(36).slice(2)}`;
    this.grants.set(code, {
      challenge: params.get('code_challenge') ?? '',
      redirectUri: params.get('redirect_uri') ?? '',
      idToken: this.sign(claims, shape.alg ?? 'RS256'),
    });
    return code;
  }

  private sign(claims: Record<string, unknown>, alg: TokenShape['alg']): string {
    if (alg === 'none') return `${b64({ alg: 'none', typ: 'JWT' })}.${b64(claims)}.`;
    if (alg === 'HS256-public') {
      const input = `${b64({ alg: 'HS256', typ: 'JWT', kid: this.key.kid })}.${b64(claims)}`;
      const secret = this.key.publicKey.export({ format: 'pem', type: 'spki' });
      return `${input}.${createHmac('sha256', secret).update(input).digest('base64url')}`;
    }
    const input = `${b64({ alg: 'RS256', typ: 'JWT', kid: this.key.kid })}.${b64(claims)}`;
    return `${input}.${sign('sha256', Buffer.from(input), this.key.privateKey).toString('base64url')}`;
  }

  private async handle(req: IncomingMessage, res: import('node:http').ServerResponse) {
    const url = new URL(req.url ?? '/', this.issuer);
    const json = (status: number, body: object) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (url.pathname === '/.well-known/openid-configuration') {
      return json(200, {
        issuer: this.advertisedIssuer ?? this.issuer,
        authorization_endpoint: `${this.issuer}/authorize`,
        token_endpoint: `${this.issuer}/token`,
        jwks_uri: `${this.issuer}/jwks`,
        code_challenge_methods_supported: ['S256'],
        token_endpoint_auth_methods_supported: ['client_secret_basic'],
        id_token_signing_alg_values_supported: ['RS256'],
      });
    }
    if (url.pathname === '/jwks') {
      this.jwksRequests += 1;
      const jwk = this.key.publicKey.export({ format: 'jwk' });
      return json(200, { keys: [{ ...jwk, kid: this.key.kid, use: 'sig', alg: 'RS256' }] });
    }
    if (url.pathname === '/token' && req.method === 'POST') {
      this.tokenRequests += 1;
      this.tokenAuthorizations.push(req.headers.authorization ?? null);
      const form = new URLSearchParams(await readBody(req));
      const basic = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      const grant = this.grants.get(form.get('code') ?? '');
      this.grants.delete(form.get('code') ?? '');
      const verifier = form.get('code_verifier') ?? '';
      const challenge = createHash('sha256').update(verifier).digest('base64url');
      if (
        req.headers.authorization !== `Basic ${basic}` ||
        form.get('grant_type') !== 'authorization_code' ||
        !grant ||
        grant.challenge !== challenge ||
        grant.redirectUri !== form.get('redirect_uri')
      ) {
        return json(400, { error: 'invalid_grant', error_description: 'provider says no <b>' });
      }
      return json(200, { access_token: 'mock-access', token_type: 'Bearer', id_token: grant.idToken });
    }
    return json(404, { error: 'not_found' });
  }
}
