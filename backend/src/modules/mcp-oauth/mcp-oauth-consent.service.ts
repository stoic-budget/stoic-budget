import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, type Repository } from 'typeorm';
import { hasPermissions } from '../../common/authz/request-permissions';
import type { Permission } from '../../common/enums/permissions.enum';
import { appError } from '../../common/errors/app-error';
import { readPluginSettings } from '../../common/utils/workspace-plugins.util';
import type {
  McpOAuthConsent,
  McpOAuthConsentQuery,
  McpOAuthConsentWorkspace,
  McpOAuthDecisionBody,
  McpOAuthRedirect,
} from '../../contracts';
import { McpOAuthCode } from '../../entities/mcp-oauth-code.entity';
import type { User } from '../../entities/user.entity';
import { WorkspaceKind } from '../../entities/workspace.entity';
import { WorkspaceMember } from '../../entities/workspace-member.entity';
import { GRANTABLE_SCOPES, SCOPE_PRESETS } from '../api-keys/api-key-scopes';
import { authorizationProblem } from './authorization-request';
import { McpOAuthClientsService } from './mcp-oauth-clients.service';
import { CODE_PREFIX, CODE_TTL_SECONDS, hashSecret, newSecret } from './oauth-crypto';
import { mcpResourceUrl, publicOrigin } from './oauth-origin';
import { isRegisteredRedirect, redirectHost, redirectWith } from './redirect-uri';

type AuthorizationRequest = McpOAuthConsentQuery;
type ScopeList = McpOAuthConsentWorkspace['write'];

/** Codes past their minute are kept a day, so a late replay still revokes its grant. */
const CODE_RETENTION_MS = 24 * 60 * 60 * 1000;

/**
 * The consent screen's server side. The person is signed in by session; the
 * app is a registered client sending its own registered redirect URI. A code
 * is minted only for a workspace the person belongs to, with MCP on there,
 * for scopes their role allows, and only when they approve.
 */
@Injectable()
export class McpOAuthConsentService {
  constructor(
    private readonly clients: McpOAuthClientsService,
    @InjectRepository(WorkspaceMember)
    private readonly members: Repository<WorkspaceMember>,
    @InjectRepository(McpOAuthCode)
    private readonly codes: Repository<McpOAuthCode>,
  ) {}

  async preview(user: User, request: AuthorizationRequest): Promise<McpOAuthConsent> {
    const { origin, client } = await this.checkClient(request);
    const problem = authorizationProblem(request, mcpResourceUrl(origin));
    if (problem) {
      return { kind: 'redirect', redirectTo: this.errorRedirect(request, origin, problem) };
    }
    const memberships = await this.members.find({
      where: { userId: user.id },
      relations: { workspace: true },
      order: { createdAt: 'ASC' },
    });
    const asked = new Set(request.scope?.split(' ').filter(Boolean) ?? []);
    return {
      kind: 'consent',
      clientName: client.clientName,
      redirectHost: redirectHost(request.redirectUri),
      requestedScopes: GRANTABLE_SCOPES.filter(scope => asked.has(scope)) as ScopeList,
      workspaces: memberships
        .filter(member => member.workspace && member.workspace.kind !== WorkspaceKind.VERSION)
        .map(member => {
          const allowed = this.allowedScopes(user, member);
          return {
            id: member.workspaceId,
            name: member.workspace.name,
            mcpEnabled: readPluginSettings(member.workspace).mcp,
            read: allowed.filter(scope => SCOPE_PRESETS.read.includes(scope)) as ScopeList,
            write: allowed as ScopeList,
          };
        }),
    };
  }

  async decide(user: User, body: McpOAuthDecisionBody): Promise<McpOAuthRedirect> {
    const { origin } = await this.checkClient(body);
    const resource = mcpResourceUrl(origin);
    const problem = authorizationProblem(body, resource);
    if (problem) {
      return { redirectTo: this.errorRedirect(body, origin, problem) };
    }
    if (!body.approve) {
      return {
        redirectTo: this.errorRedirect(body, origin, {
          error: 'access_denied',
          description: 'The person declined',
        }),
      };
    }
    const member = await this.members.findOne({
      where: { workspaceId: body.workspaceId, userId: user.id },
      relations: { workspace: true },
    });
    if (!member?.workspace || member.workspace.kind === WorkspaceKind.VERSION) {
      throw new ForbiddenException(appError('WORKSPACE_NOT_A_MEMBER'));
    }
    if (!readPluginSettings(member.workspace).mcp) {
      throw new ForbiddenException(appError('PLUGIN_DISABLED', { plugin: 'mcp' }));
    }
    const allowed = new Set<string>(this.allowedScopes(user, member));
    if (body.scopes.length === 0 || body.scopes.some(scope => !allowed.has(scope))) {
      throw new BadRequestException(appError('MCP_OAUTH_SCOPES_INVALID'));
    }
    const code = newSecret(CODE_PREFIX);
    const now = Date.now();
    // Housekeeping across the instance: only codes long dead, whoever they were for.
    await this.codes.delete({ expiresAt: LessThan(new Date(now - CODE_RETENTION_MS)) });
    await this.codes.insert({
      codeHash: hashSecret(code),
      clientId: body.clientId,
      workspaceId: member.workspaceId,
      workspaceMemberId: member.id,
      userId: user.id,
      grantedRole: member.role,
      // The version the session was checked against, not a fresh read: a reset
      // landing between that check and this insert still voids the code.
      tokenVersion: user.tokenVersion ?? 0,
      scopes: [...body.scopes],
      redirectUri: body.redirectUri,
      codeChallenge: body.codeChallenge as string,
      resource,
      expiresAt: new Date(now + CODE_TTL_SECONDS * 1000),
    });
    return { redirectTo: redirectWith(body.redirectUri, { code, state: body.state, iss: origin }) };
  }

  /**
   * An unknown client or an unregistered redirect URI is answered here, never
   * at that address (RFC 6749 §4.1.2.1): it may not be the app's at all.
   */
  private async checkClient(request: AuthorizationRequest) {
    const origin = publicOrigin();
    if (!origin) {
      throw new ServiceUnavailableException(appError('MCP_OAUTH_UNAVAILABLE'));
    }
    const client = await this.clients.findClient(request.clientId);
    if (!(client && isRegisteredRedirect(client.redirectUris, request.redirectUri))) {
      throw new BadRequestException(appError('MCP_OAUTH_REQUEST_INVALID'));
    }
    return { origin, client };
  }

  private errorRedirect(
    request: AuthorizationRequest,
    origin: string,
    problem: { error: string; description: string },
  ): string {
    return redirectWith(request.redirectUri, {
      error: problem.error,
      error_description: problem.description,
      state: request.state,
      iss: origin,
    });
  }

  /** Grantable scopes the person's account and role in this workspace allow, one by one. */
  private allowedScopes(user: User, member: WorkspaceMember): Permission[] {
    const subject = {
      user,
      workspaceRole: member.role,
      workspaceMemberPermissions: member.permissions,
    };
    return GRANTABLE_SCOPES.filter(scope => hasPermissions([scope], subject));
  }
}
