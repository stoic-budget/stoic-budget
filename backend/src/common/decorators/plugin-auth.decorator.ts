import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import type { Permission } from '../enums/permissions.enum';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermissionsGuard } from '../guards/permissions.guard';
import { PLUGIN_KEY, PluginEnabledGuard } from '../guards/plugin-enabled.guard';
import { WorkspaceContextGuard } from '../guards/workspace-context.guard';
import type { WorkspacePluginKey } from '../utils/workspace-plugins.util';
import { RequirePermission } from './require-permission.decorator';

/**
 * `WorkspaceAuth` for a route that belongs to a plugin or integration: the same
 * guards, then 403 `PLUGIN_DISABLED` while the workspace has it switched off.
 * Status reads and disconnects stay on plain `WorkspaceAuth`, so a paused
 * integration can still be looked at and removed.
 */
export function PluginAuth(plugin: WorkspacePluginKey, ...permissions: Permission[]) {
  return applyDecorators(
    UseGuards(JwtAuthGuard, WorkspaceContextGuard, PermissionsGuard, PluginEnabledGuard),
    RequirePermission(...permissions),
    SetMetadata(PLUGIN_KEY, plugin),
  );
}
