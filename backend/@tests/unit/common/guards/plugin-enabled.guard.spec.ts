import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PLUGIN_KEY, PluginEnabledGuard } from '@/common/guards/plugin-enabled.guard';

const contextFor = (plugin: string | undefined, settings: Record<string, unknown> | null) => {
  const handler = () => undefined;
  if (plugin) Reflect.defineMetadata(PLUGIN_KEY, plugin, handler);
  return {
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ workspace: { id: 'ws-1', settings } }) }),
  } as unknown as ExecutionContext;
};

describe('PluginEnabledGuard', () => {
  const guard = new PluginEnabledGuard(new Reflector());

  it('lets a route without a plugin through', () => {
    expect(guard.canActivate(contextFor(undefined, null))).toBe(true);
  });

  it('lets an integration through by default and refuses it once switched off', () => {
    expect(guard.canActivate(contextFor('imap', null))).toBe(true);
    expect(() => guard.canActivate(contextFor('imap', { plugins: { imap: false } }))).toThrow(
      ForbiddenException,
    );
  });

  it('refuses a plugin that starts off until it is switched on', () => {
    expect(() => guard.canActivate(contextFor('webhooks', {}))).toThrow(ForbiddenException);
    expect(guard.canActivate(contextFor('webhooks', { plugins: { webhooks: true } }))).toBe(true);
  });
});
