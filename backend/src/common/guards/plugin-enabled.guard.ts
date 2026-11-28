import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { appError } from '../errors/app-error';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';
import { readPluginSettings, type WorkspacePluginKey } from '../utils/workspace-plugins.util';

/** Metadata key `PluginAuth` sets: the plugin a route belongs to. */
export const PLUGIN_KEY = 'workspacePlugin';

/**
 * Refuses a route whose plugin or integration the workspace switched off. Runs
 * after `WorkspaceContextGuard`, which loaded the workspace with its settings.
 */
@Injectable()
export class PluginEnabledGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const plugin = this.reflector.getAllAndOverride<WorkspacePluginKey | undefined>(PLUGIN_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!plugin) {
      return true;
    }
    const { workspace } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!readPluginSettings(workspace)[plugin]) {
      throw new ForbiddenException(appError('PLUGIN_DISABLED', { plugin }));
    }
    return true;
  }
}
