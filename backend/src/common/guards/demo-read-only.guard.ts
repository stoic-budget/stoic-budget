import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ALLOW_IN_DEMO_KEY, REFUSE_IN_DEMO_KEY } from '../decorators/allow-in-demo.decorator';
import { ALLOW_IN_VERSION_KEY } from '../decorators/allow-in-version.decorator';
import { isDemoMode } from '../demo/demo-mode';
import { appError } from '../errors/app-error';

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * On a demo instance every request that is not a read is refused, before
 * authentication, so public routes (register, password reset) are covered
 * too. A POST that only reads (`@AllowInVersion`) and the few writes a
 * visitor needs (`@AllowInDemo`) pass, unless marked `@RefuseInDemo`.
 */
@Injectable()
export class DemoReadOnlyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (!isDemoMode() || context.getType() !== 'http') {
      return true;
    }
    const method = context.switchToHttp().getRequest<Request>().method.toUpperCase();
    if (READ_METHODS.has(method)) {
      return true;
    }
    const targets = [context.getHandler(), context.getClass()];
    const allowed =
      !this.reflector.getAllAndOverride<boolean>(REFUSE_IN_DEMO_KEY, targets) &&
      (this.reflector.getAllAndOverride<boolean>(ALLOW_IN_DEMO_KEY, targets) ||
        this.reflector.getAllAndOverride<boolean>(ALLOW_IN_VERSION_KEY, targets));
    if (!allowed) {
      throw new ForbiddenException(appError('DEMO_READ_ONLY'));
    }
    return true;
  }
}
