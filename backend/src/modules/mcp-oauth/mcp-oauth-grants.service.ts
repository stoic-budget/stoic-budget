import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type EntityManager, IsNull, type Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { AuditAction, EntityType, Severity } from '../../entities/audit-event.entity';
import type { McpOAuthClient } from '../../entities/mcp-oauth-client.entity';
import { McpOAuthGrant, type McpOAuthRevokeReason } from '../../entities/mcp-oauth-grant.entity';
import { McpOAuthToken } from '../../entities/mcp-oauth-token.entity';
import { AuditService } from '../audit/audit.service';
import { recordSecurityEvent } from '../auth/security-audit.util';
import { redirectHost } from './redirect-uri';

export interface ConnectedApp {
  id: string;
  clientName: string;
  redirectHosts: string[];
  scopes: string[];
  createdAt: Date;
  lastUsedAt: Date | null;
}

const hostsOf = (client: McpOAuthClient): string[] => [
  ...new Set(client.redirectUris.map(redirectHost)),
];

/**
 * Grants as people see them ("Connected apps") and the one way they end:
 * revoked, with their tokens deleted and an audit event. Names and scopes go
 * into the log; tokens and hashes never do.
 */
@Injectable()
export class McpOAuthGrantsService {
  private readonly logger = new Logger(McpOAuthGrantsService.name);

  constructor(
    @InjectRepository(McpOAuthGrant)
    private readonly grants: Repository<McpOAuthGrant>,
    private readonly auditService: AuditService,
  ) {}

  /** The caller's own live grants in the workspace. */
  async list(workspaceId: string, userId: string): Promise<ConnectedApp[]> {
    const rows = await this.grants.find({
      where: { workspaceId, userId, revokedAt: IsNull() },
      relations: { client: true },
      order: { createdAt: 'DESC' },
    });
    return rows.map(grant => ({
      id: grant.id,
      clientName: grant.client.clientName,
      redirectHosts: hostsOf(grant.client),
      scopes: grant.scopes,
      createdAt: grant.createdAt,
      lastUsedAt: grant.lastUsedAt,
    }));
  }

  /** Revokes one of the caller's own grants in the workspace; anything else is not found. */
  async revokeOwn(id: string, workspaceId: string, userId: string): Promise<void> {
    const grant = await this.grants.findOne({
      where: { id, workspaceId, userId, revokedAt: IsNull() },
      relations: { client: true },
    });
    if (!grant) {
      throw new NotFoundException(appError('MCP_OAUTH_GRANT_NOT_FOUND'));
    }
    await this.grants.manager.transaction(manager => this.revoke(manager, grant.id, 'user'));
    await this.audit(grant, AuditAction.DELETE, { reason: 'user' });
  }

  /**
   * Marks a grant revoked and deletes its tokens, in the caller's transaction.
   * Answers whether it was live, so a reason is logged once.
   */
  async revoke(
    manager: EntityManager,
    grantId: string,
    reason: McpOAuthRevokeReason,
  ): Promise<boolean> {
    const result = await manager.update(
      McpOAuthGrant,
      { id: grantId, revokedAt: IsNull() },
      { revokedAt: new Date(), revokedReason: reason },
    );
    await manager.delete(McpOAuthToken, { grantId });
    return (result.affected ?? 0) > 0;
  }

  /** Revokes outside a request's transaction and logs why. */
  async revokeAndAudit(grant: McpOAuthGrant, reason: McpOAuthRevokeReason): Promise<void> {
    const live = await this.grants.manager.transaction(manager =>
      this.revoke(manager, grant.id, reason),
    );
    if (live) {
      await this.audit(grant, AuditAction.DELETE, { reason });
    }
  }

  async audit(
    grant: McpOAuthGrant,
    action: AuditAction,
    extra: Record<string, unknown> = {},
  ): Promise<void> {
    const client =
      grant.client ??
      (await this.grants.findOne({ where: { id: grant.id }, relations: { client: true } }))?.client;
    await recordSecurityEvent(this.auditService, this.logger, {
      workspaceId: grant.workspaceId,
      actorId: grant.userId,
      entityType: EntityType.INTEGRATION,
      entityId: grant.id,
      action,
      severity: Severity.WARN,
      meta: {
        kind: 'mcp_oauth',
        clientName: client?.clientName ?? null,
        redirectHosts: client ? hostsOf(client) : [],
        scopes: grant.scopes,
        ...extra,
      },
    });
  }
}
