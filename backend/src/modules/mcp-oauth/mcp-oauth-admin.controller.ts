import {
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { hasPermissions } from '../../common/authz/request-permissions';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { SchemaParams } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import { appError } from '../../common/errors/app-error';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import type { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';
import { McpOAuthGrantIdParams, McpOAuthWorkspaceGrantList } from '../../contracts';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { assertSession } from './mcp-oauth-consent.controller';
import { McpOAuthGrantsService } from './mcp-oauth-grants.service';

/**
 * Who may see and end every member's connected apps: whoever manages the
 * workspace's MCP access (the plugin switch: owners and admins) or its API keys.
 */
const MANAGERS: readonly Permission[] = [
  Permission.WORKSPACE_SETTINGS_MANAGE,
  Permission.API_KEY_MANAGE,
];

/**
 * Session only: the caller is a person who manages the workspace, never a key
 * or an app. Checked here, after WorkspaceContextGuard has read the caller's
 * role in the workspace the request names.
 */
const assertManager = (request: AuthenticatedRequest): void => {
  assertSession(request);
  const user = request.user;
  if (!(user && MANAGERS.some(permission => hasPermissions([permission], { ...request, user })))) {
    throw new ForbiddenException(
      appError('AUTHZ_PERMISSIONS_REQUIRED', { permissions: MANAGERS.join(' or ') }),
    );
  }
};

/** "Connected apps" across the workspace: every member's OAuth grants, and revoking any of them. */
@ApiTags('MCP OAuth')
@Controller('mcp-oauth/workspace/grants')
@UseGuards(WorkspaceContextGuard)
export class McpOAuthAdminController {
  constructor(private readonly grants: McpOAuthGrantsService) {}

  @Get()
  @ApiOperation({ summary: 'Apps every member connected to this workspace over OAuth' })
  @SchemaResponse(McpOAuthWorkspaceGrantList)
  list(@Req() request: AuthenticatedRequest, @WorkspaceId() workspaceId: string) {
    assertManager(request);
    return this.grants.listWorkspace(workspaceId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Disconnect any member's app in this workspace" })
  async revoke(
    @Req() request: AuthenticatedRequest,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaParams(McpOAuthGrantIdParams) { id }: McpOAuthGrantIdParams,
  ) {
    assertManager(request);
    await this.grants.revokeInWorkspace(id, workspaceId, user.id);
  }
}
