import { Logger } from '@nestjs/common';
import type { EffectRuntime } from '../../../../src/common/effect/effect-runtime';
import {
  isAllowedProviderUrl,
  OidcProviderClient,
} from '../../../../src/modules/auth/oidc/oidc-provider.client';

/** OIDC_ALLOW_HTTP: plain http in production only by opt-in, and nothing else loosened. */
describe('OIDC_ALLOW_HTTP', () => {
  const saved = { nodeEnv: process.env.NODE_ENV, allow: process.env.OIDC_ALLOW_HTTP };
  const env = (nodeEnv: string, allow?: string) => {
    process.env.NODE_ENV = nodeEnv;
    if (allow === undefined) delete process.env.OIDC_ALLOW_HTTP;
    else process.env.OIDC_ALLOW_HTTP = allow;
  };

  afterEach(() => {
    env(saved.nodeEnv as string, saved.allow);
    vi.restoreAllMocks();
  });

  it('refuses http in production by default and when set to anything but true', () => {
    for (const allow of [undefined, 'false', '1', 'yes', '']) {
      env('production', allow);
      expect(isAllowedProviderUrl('http://idp.internal:9000/realms/acme')).toBe(false);
      expect(isAllowedProviderUrl('https://login.example.com')).toBe(true);
    }
  });

  it('allows http in production when opted in', () => {
    env('production', 'true');
    expect(isAllowedProviderUrl('http://idp.internal:9000/realms/acme')).toBe(true);
    env('production', ' TRUE ');
    expect(isAllowedProviderUrl('http://authentik:9000/application/o/acme/')).toBe(true);
  });

  it('still refuses credentials in the address and other schemes when opted in', () => {
    env('production', 'true');
    expect(isAllowedProviderUrl('http://user:secret@idp.internal')).toBe(false);
    expect(isAllowedProviderUrl('https://user@login.example.com')).toBe(false);
    expect(isAllowedProviderUrl('ftp://idp.internal')).toBe(false);
    expect(isAllowedProviderUrl('javascript:alert(1)')).toBe(false);
    expect(isAllowedProviderUrl('not a url')).toBe(false);
  });

  it('keeps http open outside production, as before', () => {
    env('development');
    expect(isAllowedProviderUrl('http://127.0.0.1:9000')).toBe(true);
  });

  describe('the warning', () => {
    const issuer = 'http://idp.internal:9000';
    const document = {
      issuer,
      authorization_endpoint: `${issuer}/authorize`,
      token_endpoint: `${issuer}/token`,
      jwks_uri: `${issuer}/jwks`,
    };
    const client = () =>
      new OidcProviderClient({
        run: async () => ({ ok: true, value: document }),
      } as unknown as EffectRuntime);

    it('is logged once per issuer when saved or used in production over http', async () => {
      env('production', 'true');
      const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const provider = client();
      provider.warnIfHttp(issuer);
      await provider.discover(issuer);
      provider.forget();
      await provider.discover(issuer);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0][0])).toContain('private network');
    });

    it('is logged for an https issuer whose endpoints are http', async () => {
      env('production', 'true');
      const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const secure = 'https://login.example.com';
      const provider = new OidcProviderClient({
        run: async () => ({ ok: true, value: { ...document, issuer: secure } }),
      } as unknown as EffectRuntime);
      await provider.discover(secure);
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it('is not logged for https, or outside production', async () => {
      const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      env('production', 'true');
      client().warnIfHttp('https://login.example.com');
      env('development');
      await client().discover(issuer);
      expect(warn).not.toHaveBeenCalled();
    });
  });
});
