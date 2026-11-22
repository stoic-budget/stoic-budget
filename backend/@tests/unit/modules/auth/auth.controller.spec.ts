import { THROTTLER_LIMIT, THROTTLER_TTL } from '@nestjs/throttler/dist/throttler.constants';
import { AuthController } from '@/modules/auth/auth.controller';
import { PasskeysController } from '@/modules/auth/passkeys/passkeys.controller';

describe('AuthController', () => {
  it('proxies register/login/logout operations', async () => {
    const authService = {
      register: vi.fn(async () => ({ user: { id: 'u1' }, access_token: 'a', refresh_token: 'r' })),
      login: vi.fn(async () => ({ user: { id: 'u1' }, access_token: 'a', refresh_token: 'r' })),
      refreshToken: vi.fn(async () => ({ access_token: 'new', refresh_token: 'r2' })),
      logout: vi.fn(async () => ({ message: 'ok' })),
      logoutAll: vi.fn(async () => ({ message: 'ok-all' })),
      getSessions: vi.fn(async () => [{ id: 's1' }]),
      logoutSession: vi.fn(async () => ({ message: 'ok-session' })),
    };
    const twoFactorService = {
      getStatus: vi.fn(async () => ({
        enabled: false,
        pendingSetup: false,
        recoveryCodesRemaining: 0,
      })),
      setup: vi.fn(async () => ({ secret: 's', otpauthUrl: 'otpauth://', qrDataUrl: 'data:' })),
      enable: vi.fn(async () => ({ recoveryCodes: ['AAAAA-BBBBB'] })),
      disable: vi.fn(async () => undefined),
      regenerateRecoveryCodes: vi.fn(async () => ({ recoveryCodes: ['CCCCC-DDDDD'] })),
    };
    const controller = new AuthController(authService as any, twoFactorService as any);
    const cookies: Record<string, string> = {};
    const res = {
      cookie: vi.fn((name: string, value: string) => {
        cookies[name] = value;
      }),
      clearCookie: vi.fn((name: string) => {
        delete cookies[name];
      }),
    };
    const req = {
      headers: {
        authorization: 'Bearer token',
        'user-agent': 'Mozilla/5.0',
        'x-forwarded-for': '10.0.0.1',
      },
      cookies: {},
      user: { currentSessionId: 's1' },
      ip: '10.0.0.2',
    };

    // Tokens go into httpOnly cookies and must not reach the response body,
    // which is what keeps an XSS from reading them.
    await expect(
      controller.register({ email: 'a@b.com' } as any, req as any, res as any),
    ).resolves.toEqual({ user: { id: 'u1' } });
    expect(cookies.access_token).toBe('a');
    expect(cookies.refresh_token).toBe('r');
    expect(cookies.csrf_token).toEqual(expect.any(String));
    expect(res.cookie).toHaveBeenCalledWith(
      'access_token',
      'a',
      expect.objectContaining({ httpOnly: true }),
    );
    expect(res.cookie).toHaveBeenCalledWith(
      'csrf_token',
      expect.any(String),
      expect.objectContaining({ httpOnly: false }),
    );

    await expect(
      controller.login({ email: 'a@b.com', password: 'x' } as any, req as any, res as any),
    ).resolves.toEqual({ user: { id: 'u1' } });

    await expect(controller.refresh(req as any, res as any)).resolves.toEqual({
      message: 'Token refreshed',
    });

    await expect(controller.logout({ id: 'u1' } as any, req as any, res as any)).resolves.toEqual({
      message: 'ok',
    });
    expect(cookies.access_token).toBeUndefined();
    expect(cookies.refresh_token).toBeUndefined();

    await expect(controller.logoutAll({ id: 'u1' } as any, {}, res as any)).resolves.toEqual({
      message: 'ok-all',
    });
    await expect(controller.getSessions({ id: 'u1' } as any, req)).resolves.toEqual([{ id: 's1' }]);
    await expect(controller.logoutSession({ id: 'u1' } as any, { sessionId: 's1' })).resolves.toEqual({
      message: 'ok-session',
    });
    // The profile is the user's view, never the row: no credentials ride along.
    const profile = await controller.getProfile({
      id: 'u1',
      email: 'a@b.com',
      passwordHash: 'hash',
      tokenVersion: 3,
    } as any);
    expect(profile).toMatchObject({ id: 'u1', email: 'a@b.com' });
    expect(profile).not.toHaveProperty('passwordHash');
    expect(profile).not.toHaveProperty('tokenVersion');

    expect(authService.logout).toHaveBeenCalledWith('u1', 's1');
    expect(authService.getSessions).toHaveBeenCalledWith('u1', 's1');
  });

  it('limits log-out-everywhere as tightly as a passkey remove, since both check the password', () => {
    const limitOf = (handler: object) => ({
      limit: Reflect.getMetadata(`${THROTTLER_LIMIT}default`, handler),
      ttl: Reflect.getMetadata(`${THROTTLER_TTL}default`, handler),
    });
    expect(limitOf(PasskeysController.prototype.remove)).toEqual({ limit: 5, ttl: 60000 });
    expect(limitOf(AuthController.prototype.logoutAll)).toEqual(
      limitOf(PasskeysController.prototype.remove),
    );
  });

  describe('session origin on a demo, where every visitor is one account', () => {
    const previous = process.env.DEMO_MODE;
    afterEach(() => {
      process.env.DEMO_MODE = previous;
    });

    const visitorAddress = '203.0.113.7';
    const visitorAgent = 'Mozilla/5.0 (X11; Linux x86_64) Firefox/131.0';
    const storedSession = {
      id: 's1',
      device: 'Desktop',
      browser: 'Firefox',
      os: 'Linux',
      ipAddress: visitorAddress,
      createdAt: new Date(0),
      lastUsedAt: new Date(0),
      isCurrent: true,
    };
    const setup = () => {
      const authService = {
        login: vi.fn(async () => ({ user: { id: 'u1' }, access_token: 'a', refresh_token: 'r' })),
        refreshToken: vi.fn(async () => ({ access_token: 'a2', refresh_token: 'r2' })),
        getSessions: vi.fn(async () => [storedSession]),
      };
      const controller = new AuthController(authService as any, {} as any);
      const res = { cookie: vi.fn(), clearCookie: vi.fn() };
      const req = {
        headers: { 'user-agent': visitorAgent },
        cookies: { refresh_token: 'r' },
        user: { currentSessionId: 's1' },
        ip: visitorAddress,
      };
      return { authService, controller, res, req };
    };

    it('records neither the address nor the browser and shows none back', async () => {
      process.env.DEMO_MODE = 'true';
      const { authService, controller, res, req } = setup();
      await controller.login({ email: 'a@b.com', password: 'x' } as any, req as any, res as any);
      await controller.refresh(req as any, res as any);
      const none = { userAgent: null, ipAddress: null };
      expect(authService.login).toHaveBeenCalledWith(expect.anything(), expect.objectContaining(none));
      expect(authService.refreshToken).toHaveBeenCalledWith('r', none);

      // A row stored before the instance became a demo is not shown either.
      await expect(controller.getSessions({ id: 'u1' } as any, req as any)).resolves.toEqual([
        {
          ...storedSession,
          ipAddress: null,
          device: 'Unknown device',
          browser: 'Unknown browser',
          os: 'Unknown OS',
        },
      ]);
    });

    it('keeps both off a demo', async () => {
      process.env.DEMO_MODE = 'false';
      const { authService, controller, res, req } = setup();
      await controller.login({ email: 'a@b.com', password: 'x' } as any, req as any, res as any);
      expect(authService.login).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        userAgent: visitorAgent,
        ipAddress: visitorAddress,
      }));
      await expect(controller.getSessions({ id: 'u1' } as any, req as any)).resolves.toEqual([
        storedSession,
      ]);
    });
  });
});
