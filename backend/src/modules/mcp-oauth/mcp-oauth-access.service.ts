import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { McpOAuthGrant } from '../../entities/mcp-oauth-grant.entity';
import { McpOAuthToken } from '../../entities/mcp-oauth-token.entity';
import type { User } from '../../entities/user.entity';
import { McpOAuthGrantsService } from './mcp-oauth-grants.service';
import { ACCESS_TOKEN_PREFIX, hashSecret } from './oauth-crypto';
import { isSameResource, mcpResourceUrl, publicOrigin } from './oauth-origin';

export interface McpAccess {
  grant: McpOAuthGrant;
  /** What this access token carries: the grant's scopes, or fewer after a narrowed refresh. */
  scopes: string[];
  user: User;
  clientName: string;
}

/** `lastUsedAt` is written at most this often per grant: it is shown, not audited. */
const LAST_USED_RESOLUTION_MS = 60_000;

/**
 * Resolves an access token for the MCP endpoint. The token must be live, its
 * grant unrevoked and bound to this endpoint, its owner active and still in the
 * role they approved under; a changed role revokes the grant for good. Leaving
 * the workspace or the workspace going delete the grant outright (foreign keys).
 */
@Injectable()
export class McpOAuthAccessService {
  private readonly logger = new Logger(McpOAuthAccessService.name);

  constructor(
    @InjectRepository(McpOAuthToken)
    private readonly tokens: Repository<McpOAuthToken>,
    private readonly grants: McpOAuthGrantsService,
  ) {}

  async authenticate(rawToken: string): Promise<McpAccess | null> {
    const origin = publicOrigin();
    if (!(origin && rawToken.startsWith(ACCESS_TOKEN_PREFIX))) {
      return null;
    }
    const token = await this.tokens.findOne({
      where: { tokenHash: hashSecret(rawToken), kind: 'access' },
      relations: { grant: { user: true, workspaceMember: true, client: true } },
    });
    const now = new Date();
    const grant = token?.grant;
    if (!(token && grant) || token.expiresAt <= now || grant.revokedAt) {
      return null;
    }
    if (!isSameResource(grant.resource, mcpResourceUrl(origin))) {
      return null;
    }
    if (grant.workspaceMember?.role !== grant.grantedRole) {
      await this.grants.revokeAndAudit(grant, 'role_changed');
      return null;
    }
    if (!grant.user || grant.user.isActive === false) {
      return null;
    }
    if (!grant.lastUsedAt || now.getTime() - grant.lastUsedAt.getTime() > LAST_USED_RESOLUTION_MS) {
      void this.tokens.manager
        .update(McpOAuthGrant, { id: grant.id }, { lastUsedAt: now })
        .catch((error: unknown) => {
          this.logger.warn(`lastUsedAt of grant ${grant.id} not saved: ${String(error)}`);
        });
    }
    return {
      grant,
      scopes: token.scopes ?? grant.scopes,
      user: grant.user,
      clientName: grant.client.clientName,
    };
  }
}
