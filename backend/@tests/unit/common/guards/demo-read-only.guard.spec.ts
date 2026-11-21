import { ALLOW_IN_DEMO_KEY } from '@/common/decorators/allow-in-demo.decorator';
import { ALLOW_IN_VERSION_KEY } from '@/common/decorators/allow-in-version.decorator';
import { DemoReadOnlyGuard } from '@/common/guards/demo-read-only.guard';
import { ForbiddenException } from '@nestjs/common';

const contextFor = (method: string, type = 'http') =>
  ({
    getType: () => type,
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ method }) }),
  }) as any;

/** A reflector that answers true only for the metadata keys a route carries. */
const routeMarkedWith = (...keys: string[]) =>
  new DemoReadOnlyGuard({ getAllAndOverride: (key: string) => keys.includes(key) } as any);

const forbiddenCode = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(ForbiddenException);
    return ((error as ForbiddenException).getResponse() as { code?: string }).code;
  }
  throw new Error('expected the guard to refuse');
};

describe('DemoReadOnlyGuard', () => {
  const previous = process.env.DEMO_MODE;
  afterEach(() => {
    process.env.DEMO_MODE = previous;
  });

  it('lets every request through when the instance is not a demo', () => {
    delete process.env.DEMO_MODE;
    expect(routeMarkedWith().canActivate(contextFor('DELETE'))).toBe(true);
    process.env.DEMO_MODE = 'false';
    expect(routeMarkedWith().canActivate(contextFor('POST'))).toBe(true);
  });

  describe('on a demo instance', () => {
    beforeEach(() => {
      process.env.DEMO_MODE = 'true';
    });

    it('answers reads', () => {
      for (const method of ['GET', 'HEAD', 'OPTIONS', 'get']) {
        expect(routeMarkedWith().canActivate(contextFor(method))).toBe(true);
      }
    });

    it('refuses an unmarked write with DEMO_READ_ONLY', () => {
      for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
        expect(forbiddenCode(() => routeMarkedWith().canActivate(contextFor(method)))).toBe(
          'DEMO_READ_ONLY',
        );
      }
    });

    it('answers a write marked @AllowInDemo or @AllowInVersion', () => {
      expect(routeMarkedWith(ALLOW_IN_DEMO_KEY).canActivate(contextFor('POST'))).toBe(true);
      expect(routeMarkedWith(ALLOW_IN_VERSION_KEY).canActivate(contextFor('POST'))).toBe(true);
    });

    it('leaves non-HTTP contexts alone', () => {
      expect(routeMarkedWith().canActivate(contextFor('POST', 'ws'))).toBe(true);
    });
  });
});
