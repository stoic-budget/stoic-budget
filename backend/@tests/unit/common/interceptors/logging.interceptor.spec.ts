import { type CallHandler, type ExecutionContext, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';
import { LoggingInterceptor } from '@/common/interceptors/logging.interceptor';
import { Public } from '@/modules/auth/decorators/public.decorator';

const TOKEN = 'feedTokenForMemberOne_0123456789ab';

class Handlers {
  @Public()
  feed() {}

  shared() {}
}

/** One request through the interceptor; what it wrote to the log. */
async function logged(handler: keyof Handlers, request: object): Promise<string> {
  const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  const context = {
    switchToHttp: () => ({
      getRequest: () => ({ method: 'GET', ...request }),
      getResponse: () => ({ statusCode: 200 }),
    }),
    getHandler: () => Handlers.prototype[handler],
    getClass: () => Handlers,
  } as unknown as ExecutionContext;
  const next: CallHandler = { handle: () => of('body') };
  await lastValueFrom(new LoggingInterceptor(new Reflector()).intercept(context, next));
  const lines = JSON.stringify(log.mock.calls);
  log.mockRestore();
  return lines;
}

describe('LoggingInterceptor', () => {
  it('logs the route pattern, never the token, of a public calendar feed', async () => {
    const lines = await logged('feed', {
      url: `/api/v1/public/calendar/${TOKEN}.ics`,
      baseUrl: '/api/v1',
      route: { path: '/public/calendar/:token.ics' },
    });
    expect(lines).toContain('/api/v1/public/calendar/:token.ics');
    expect(lines).not.toContain(TOKEN);
  });

  it('logs the pattern of a @Public() route whose url names no /public/ or :token', async () => {
    const lines = await logged('feed', {
      url: `/auth/verify-email?code=${TOKEN}`,
      route: { path: '/auth/verify-email' },
    });
    expect(lines).toContain('/auth/verify-email');
    expect(lines).not.toContain(TOKEN);
  });

  it('keeps the full url of an ordinary route', async () => {
    const lines = await logged('shared', { url: '/payables?status=open', route: { path: '/payables' } });
    expect(lines).toContain('/payables?status=open');
  });
});
