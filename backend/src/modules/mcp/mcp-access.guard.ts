import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import { appError } from '../../common/errors/app-error';
import type { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { McpOAuthAccessService } from '../mcp-oauth/mcp-oauth-access.service';
import { publicOrigin, resourceMetadataUrl } from '../mcp-oauth/oauth-origin';
import { WorkspacePluginsService } from '../workspaces/workspace-plugins.service';

const BEARER = /^Bearer\s+(\S+)$/i;

/**
 * The MCP endpoint takes an API key (checked by `JwtAuthGuard`) or an OAuth
 * access token (checked here), and only while the workspace has the MCP plugin
 * on. Switching it off leaves a key's REST access alone. A request without
 * either is told where to find the authorization server (RFC 9728 §5.1).
 */
@Injectable()
export class McpAccessGuard implements CanActivate {
  constructor(
    private readonly plugins: WorkspacePluginsService,
    private readonly oauth: McpOAuthAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<AuthenticatedRequest>();
    if (!request.apiKey) {
      await this.authenticateBearer(request, http.getResponse<Response>());
    }
    const workspaceId = request.apiKeyWorkspaceId ?? request.mcpGrant?.workspaceId;
    await this.plugins.assertEnabled(workspaceId as string, 'mcp');
    return true;
  }

  private async authenticateBearer(
    request: AuthenticatedRequest,
    response: Response,
  ): Promise<void> {
    const token = BEARER.exec(request.headers.authorization ?? '')?.[1];
    const access = token ? await this.oauth.authenticate(token) : null;
    if (!access) {
      response.setHeader('WWW-Authenticate', this.challenges(Boolean(token)));
      throw new UnauthorizedException(
        appError(token ? 'MCP_ACCESS_TOKEN_INVALID' : 'MCP_CREDENTIALS_REQUIRED'),
      );
    }
    const { grant } = access;
    request.user = access.user as AuthenticatedUser;
    // The grant names the workspace; whatever header came along is replaced.
    request.headers['x-workspace-id'] = grant.workspaceId;
    request.mcpGrant = {
      id: grant.id,
      clientId: grant.clientId,
      clientName: access.clientName,
      workspaceId: grant.workspaceId,
      scopes: access.scopes,
    };
  }

  private challenges(invalidToken: boolean): string[] {
    const origin = publicOrigin();
    const bearer = [
      origin ? `resource_metadata="${resourceMetadataUrl(origin)}"` : null,
      invalidToken ? 'error="invalid_token"' : null,
    ]
      .filter(Boolean)
      .join(', ');
    return [bearer ? `Bearer ${bearer}` : 'Bearer', 'ApiKey header="X-Api-Key"'];
  }
}
