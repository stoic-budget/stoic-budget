import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Effect, Schema } from 'effect';
import type { JSONWebKeySet } from 'jose';
import { type AppServices, EffectRuntime } from '../../../common/effect/effect-runtime';
import { describeHttpFailure, getJson, postForm } from '../../../common/effect/http-json';
import { OidcRefusal } from './oidc-refusal';

const Discovery = Schema.Struct({
  issuer: Schema.String,
  authorization_endpoint: Schema.String,
  token_endpoint: Schema.String,
  jwks_uri: Schema.String,
  code_challenge_methods_supported: Schema.optional(Schema.Array(Schema.String)),
  token_endpoint_auth_methods_supported: Schema.optional(Schema.Array(Schema.String)),
});
export type OidcDiscovery = typeof Discovery.Type;

const Jwks = Schema.Struct({ keys: Schema.Array(Schema.Record(Schema.String, Schema.Unknown)) });
/** Only the ID token is read: no access token is kept or used. */
const TokenAnswer = Schema.Struct({ id_token: Schema.String });

const TIMEOUT = '10 seconds';
const CACHE_MS = 10 * 60 * 1000;

const isProduction = (): boolean => process.env.NODE_ENV === 'production';

/**
 * OIDC_ALLOW_HTTP=true: the administrator's opt-in to a plain-http provider in
 * production, for one reached over a private network (a Docker network next
 * to this API). It changes nothing else about which addresses are refused.
 */
const httpAllowedInProduction = (): boolean =>
  process.env.OIDC_ALLOW_HTTP?.trim().toLowerCase() === 'true';

/**
 * https only, except outside production (a provider on the developer's
 * machine) or with OIDC_ALLOW_HTTP. Never credentials in the address. Every
 * address the discovery document names is held to the same rule as the issuer.
 */
export function isAllowedProviderUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.username || url.password) return false;
    if (url.protocol === 'https:') return true;
    return url.protocol === 'http:' && (!isProduction() || httpAllowedInProduction());
  } catch {
    return false;
  }
}

const discoveryUrl = (issuer: string): string =>
  `${issuer.replace(/\/+$/, '')}/.well-known/openid-configuration`;

/**
 * The calls to the provider: discovery, the token endpoint and its keys. The
 * addresses come only from the administrator's issuer and the discovery
 * document it serves, never from the browser.
 */
@Injectable()
export class OidcProviderClient {
  private readonly logger = new Logger(OidcProviderClient.name);
  private readonly discoveries = new Map<string, { value: OidcDiscovery; at: number }>();
  private readonly keySets = new Map<string, { value: JSONWebKeySet; at: number }>();
  /** Issuers already warned about plain http, so a sign-in does not log it again. */
  private readonly warnedHttp = new Set<string>();

  constructor(private readonly effects: EffectRuntime) {}

  async discover(issuer: string): Promise<OidcDiscovery> {
    const cached = this.discoveries.get(issuer);
    if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;
    if (!isAllowedProviderUrl(issuer)) throw new OidcRefusal('OIDC_ISSUER_INSECURE');

    const document = await this.fetch(
      'discovery',
      getJson(discoveryUrl(issuer), Discovery, { timeout: TIMEOUT }),
    );
    // OpenID Connect Discovery §4.3: the document must name exactly the issuer
    // it was fetched for, or one provider could speak for another.
    if (document.issuer !== issuer) {
      throw new OidcRefusal('OIDC_ISSUER_MISMATCH', HttpStatus.BAD_GATEWAY);
    }
    const endpoints = [document.authorization_endpoint, document.token_endpoint, document.jwks_uri];
    if (!endpoints.every(isAllowedProviderUrl)) {
      throw new OidcRefusal('OIDC_ISSUER_INSECURE', HttpStatus.BAD_GATEWAY);
    }
    this.warnIfHttp(issuer, endpoints);
    const methods = document.code_challenge_methods_supported;
    if (methods && !methods.includes('S256')) {
      throw new OidcRefusal('OIDC_PROVIDER_UNAVAILABLE', HttpStatus.BAD_GATEWAY);
    }
    this.discoveries.set(issuer, { value: document, at: Date.now() });
    return document;
  }

  /** The provider's signing keys; `fresh` skips the cache once a token names an unknown key. */
  async keys(jwksUri: string, fresh: boolean): Promise<JSONWebKeySet> {
    const cached = this.keySets.get(jwksUri);
    if (!fresh && cached && Date.now() - cached.at < CACHE_MS) return cached.value;
    const jwks = await this.fetch('keys', getJson(jwksUri, Jwks, { timeout: TIMEOUT }));
    const value = { keys: jwks.keys.map(key => ({ ...key })) } as JSONWebKeySet;
    this.keySets.set(jwksUri, { value, at: Date.now() });
    return value;
  }

  /**
   * Trades the authorization code for the ID token, proving the PKCE verifier.
   * A confidential client authenticates with HTTP Basic unless the provider
   * accepts only `client_secret_post`.
   */
  async exchangeCode(
    discovery: OidcDiscovery,
    client: { clientId: string; clientSecret: string | null },
    grant: { code: string; verifier: string; redirectUri: string },
  ): Promise<string> {
    const form: Record<string, string> = {
      grant_type: 'authorization_code',
      code: grant.code,
      redirect_uri: grant.redirectUri,
      code_verifier: grant.verifier,
    };
    const headers: Record<string, string> = {};
    const methods = discovery.token_endpoint_auth_methods_supported;
    const postOnly =
      methods?.includes('client_secret_post') && !methods.includes('client_secret_basic');
    if (client.clientSecret && !postOnly) {
      const encode = (value: string) => encodeURIComponent(value);
      const basic = `${encode(client.clientId)}:${encode(client.clientSecret)}`;
      headers.authorization = `Basic ${Buffer.from(basic).toString('base64')}`;
    } else {
      form.client_id = client.clientId;
      if (client.clientSecret) form.client_secret = client.clientSecret;
    }
    const answer = await this.fetch(
      'token',
      postForm(discovery.token_endpoint, form, TokenAnswer, { timeout: TIMEOUT, headers }),
    );
    return answer.id_token;
  }

  /**
   * One warning per issuer while this server runs, when it is saved or first
   * used: plain http in production is allowed only by OIDC_ALLOW_HTTP.
   */
  warnIfHttp(issuer: string, endpoints: string[] = []): void {
    const http = [issuer, ...endpoints].some(value => value.toLowerCase().startsWith('http:'));
    if (!(isProduction() && http) || this.warnedHttp.has(issuer)) return;
    this.warnedHttp.add(issuer);
    this.logger.warn(
      `OIDC provider ${issuer} is reached over plain http in production (OIDC_ALLOW_HTTP=true). ` +
        'Tokens and the client secret travel unencrypted: keep it on a private network only.',
    );
  }

  /** Forget cached answers, e.g. after the administrator changed the provider. */
  forget(): void {
    this.discoveries.clear();
    this.keySets.clear();
  }

  /**
   * Runs a provider call; any failure is "unavailable". Logged by step and
   * status only: the answer may carry codes or tokens.
   */
  private async fetch<A, E extends { readonly _tag: string }>(
    step: string,
    call: Effect.Effect<A, E, AppServices>,
  ): Promise<A> {
    const result = await this.effects.run(
      call.pipe(
        Effect.map(value => ({ ok: true as const, value })),
        Effect.catch(error =>
          Effect.sync(() => {
            this.logger.warn(`OIDC ${step} request failed: ${describeHttpFailure(error)}`);
            return { ok: false as const };
          }),
        ),
      ),
    );
    if (!result.ok) throw new OidcRefusal('OIDC_PROVIDER_UNAVAILABLE', HttpStatus.BAD_GATEWAY);
    return result.value;
  }
}
