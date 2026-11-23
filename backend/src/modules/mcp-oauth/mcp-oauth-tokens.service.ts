import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { type DataSource, type EntityManager, LessThan } from 'typeorm';
import { AuditAction } from '../../entities/audit-event.entity';
import { McpOAuthCode } from '../../entities/mcp-oauth-code.entity';
import { McpOAuthGrant, type McpOAuthRevokeReason } from '../../entities/mcp-oauth-grant.entity';
import { McpOAuthToken } from '../../entities/mcp-oauth-token.entity';
import { User } from '../../entities/user.entity';
import { WorkspaceMember } from '../../entities/workspace-member.entity';
import { McpOAuthGrantsService } from './mcp-oauth-grants.service';
import {
  ACCESS_TOKEN_PREFIX,
  ACCESS_TOKEN_TTL_SECONDS,
  hashSecret,
  newSecret,
  REFRESH_TOKEN_PREFIX,
  REFRESH_TOKEN_TTL_SECONDS,
  verifyPkce,
} from './oauth-crypto';
import { type OAuthResult, oauthFailure } from './oauth-error';
import { isSameResource } from './oauth-origin';
import { refreshVerdict } from './refresh-verdict';

/** The token answer of RFC 6749 §5.1. */
export interface TokenSet {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export interface CodeExchange {
  code: string;
  codeVerifier: string;
  redirectUri: string;
  clientId: string;
  resource?: string;
}

export interface RefreshRequest {
  refreshToken: string;
  clientId: string;
  resource?: string;
  scope?: string;
}

/** Revocations decided inside a transaction, logged after it commits. */
type Revoked = { grant: McpOAuthGrant; reason: McpOAuthRevokeReason };

const addSeconds = (date: Date, seconds: number) => new Date(date.getTime() + seconds * 1000);

/**
 * The token endpoint: codes are exchanged once, refresh tokens rotate on every
 * use, and a code or refresh token presented a second time revokes the whole
 * grant (someone else has a copy). Both run under a row lock so two parallel
 * requests cannot both win.
 */
@Injectable()
export class McpOAuthTokensService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly grants: McpOAuthGrantsService,
  ) {}

  async exchangeCode(request: CodeExchange): Promise<OAuthResult<TokenSet>> {
    const revoked: Revoked[] = [];
    const result = await this.dataSource.transaction(async manager => {
      const code = await manager.findOne(McpOAuthCode, {
        where: { codeHash: hashSecret(request.code) },
        lock: { mode: 'pessimistic_write' },
      });
      if (!code) {
        return oauthFailure('invalid_grant', 'Unknown authorization code');
      }
      if (code.usedAt) {
        await this.revokeInside(manager, code.grantId, 'code_reuse', revoked);
        return oauthFailure('invalid_grant', 'The authorization code was already used');
      }
      // Burnt before anything is checked: a wrong verifier cannot be retried.
      const now = new Date();
      await manager.update(McpOAuthCode, { id: code.id }, { usedAt: now });
      if (code.expiresAt <= now) {
        return oauthFailure('invalid_grant', 'The authorization code has expired');
      }
      if (code.clientId !== request.clientId || code.redirectUri !== request.redirectUri) {
        return oauthFailure(
          'invalid_grant',
          'The code was issued to another client or redirect URI',
        );
      }
      if (!verifyPkce(request.codeVerifier, code.codeChallenge)) {
        return oauthFailure('invalid_grant', 'PKCE verification failed');
      }
      if (request.resource !== undefined && !isSameResource(request.resource, code.resource)) {
        return oauthFailure('invalid_target', 'The resource does not match the authorization');
      }
      const member = await manager.findOne(WorkspaceMember, {
        where: { id: code.workspaceMemberId, workspaceId: code.workspaceId, userId: code.userId },
      });
      if (member?.role !== code.grantedRole) {
        return oauthFailure('invalid_grant', 'Your access to the workspace has changed');
      }
      const user = await manager.findOne(User, {
        where: { id: code.userId },
        select: { id: true, isActive: true, tokenVersion: true },
      });
      if (user?.isActive !== true) {
        return oauthFailure('invalid_grant', 'The account is disabled');
      }
      // A password reset or "log out everywhere" since the approval ends the
      // session that approved it, and with it the code.
      if ((user.tokenVersion ?? 0) !== code.tokenVersion) {
        return oauthFailure('invalid_grant', 'The session that approved the code has ended');
      }
      const grant = await manager.save(
        manager.create(McpOAuthGrant, {
          clientId: code.clientId,
          workspaceId: code.workspaceId,
          workspaceMemberId: code.workspaceMemberId,
          userId: code.userId,
          grantedRole: code.grantedRole,
          scopes: code.scopes,
          resource: code.resource,
        }),
      );
      await manager.update(McpOAuthCode, { id: code.id }, { grantId: grant.id });
      return { ok: true as const, value: { grant, tokens: await this.issue(manager, grant) } };
    });
    await this.auditRevoked(revoked);
    if (!result.ok) {
      return result;
    }
    await this.grants.audit(result.value.grant, AuditAction.CREATE);
    return { ok: true, value: result.value.tokens };
  }

  async refresh(request: RefreshRequest): Promise<OAuthResult<TokenSet>> {
    const revoked: Revoked[] = [];
    const result = await this.dataSource.transaction(
      async (manager): Promise<OAuthResult<TokenSet>> => {
        const token = await manager.findOne(McpOAuthToken, {
          where: { tokenHash: hashSecret(request.refreshToken), kind: 'refresh' },
          lock: { mode: 'pessimistic_write' },
        });
        const grant = token
          ? await manager.findOne(McpOAuthGrant, { where: { id: token.grantId } })
          : null;
        const member = grant
          ? await manager.findOne(WorkspaceMember, {
              where: { id: grant.workspaceMemberId, workspaceId: grant.workspaceId },
            })
          : null;
        const verdict = refreshVerdict({
          token,
          grant,
          memberRole: member?.role ?? null,
          userActive: grant ? await this.isActiveUser(manager, grant.userId) : false,
          clientId: request.clientId,
          now: new Date(),
        });
        if (verdict.kind === 'revoke' && grant) {
          await this.revokeInside(manager, grant.id, verdict.reason, revoked);
        }
        if (verdict.kind !== 'rotate') {
          return oauthFailure('invalid_grant', verdict.description);
        }
        const granted = verdict.grant;
        if (request.resource !== undefined && !isSameResource(request.resource, granted.resource)) {
          return oauthFailure('invalid_target', 'The resource does not match the grant');
        }
        const asked = new Set(request.scope?.split(' ').filter(Boolean) ?? []);
        if ([...asked].some(scope => !granted.scopes.includes(scope))) {
          return oauthFailure('invalid_scope', 'A scope was not part of the grant');
        }
        // RFC 6749 §6: a narrower ask narrows this access token; the grant keeps its scopes.
        const scopes = asked.size > 0 ? granted.scopes.filter(scope => asked.has(scope)) : null;
        await manager.update(McpOAuthToken, { id: verdict.token.id }, { usedAt: new Date() });
        return { ok: true, value: await this.issue(manager, granted, scopes) };
      },
    );
    await this.auditRevoked(revoked);
    return result;
  }

  /**
   * RFC 7009: either token of a grant revokes the whole grant. An unknown
   * token, or one issued to another client, changes nothing and is not told apart.
   */
  async revokeToken(rawToken: string, clientId: string | undefined): Promise<void> {
    const token = await this.dataSource.getRepository(McpOAuthToken).findOne({
      where: { tokenHash: hashSecret(rawToken) },
      relations: { grant: { client: true } },
    });
    if (!token?.grant || (clientId !== undefined && token.grant.clientId !== clientId)) {
      return;
    }
    await this.grants.revokeAndAudit(token.grant, 'client');
  }

  /** `scopes` narrows the access token below the grant; null carries the grant's own. */
  private async issue(
    manager: EntityManager,
    grant: McpOAuthGrant,
    scopes: string[] | null = null,
  ): Promise<TokenSet> {
    const now = new Date();
    const access = newSecret(ACCESS_TOKEN_PREFIX);
    const refresh = newSecret(REFRESH_TOKEN_PREFIX);
    // Expired rows of this grant only; used refresh tokens stay until they
    // expire, so a replay is still recognised as one.
    await manager.delete(McpOAuthToken, { grantId: grant.id, expiresAt: LessThan(now) });
    await manager.insert(McpOAuthToken, [
      {
        grantId: grant.id,
        kind: 'access',
        tokenHash: hashSecret(access),
        scopes,
        expiresAt: addSeconds(now, ACCESS_TOKEN_TTL_SECONDS),
      },
      {
        grantId: grant.id,
        kind: 'refresh',
        tokenHash: hashSecret(refresh),
        expiresAt: addSeconds(now, REFRESH_TOKEN_TTL_SECONDS),
      },
    ]);
    return {
      access_token: access,
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      refresh_token: refresh,
      scope: (scopes ?? grant.scopes).join(' '),
    };
  }

  private async isActiveUser(manager: EntityManager, userId: string): Promise<boolean> {
    const user = await manager.findOne(User, {
      where: { id: userId },
      select: { id: true, isActive: true },
    });
    return user?.isActive === true;
  }

  private async revokeInside(
    manager: EntityManager,
    grantId: string | null,
    reason: McpOAuthRevokeReason,
    revoked: Revoked[],
  ): Promise<void> {
    if (!grantId) return;
    const grant = await manager.findOne(McpOAuthGrant, { where: { id: grantId } });
    if (grant && (await this.grants.revoke(manager, grantId, reason))) {
      revoked.push({ grant, reason });
    }
  }

  private async auditRevoked(revoked: Revoked[]): Promise<void> {
    for (const { grant, reason } of revoked) {
      await this.grants.audit(grant, AuditAction.DELETE, { reason });
    }
  }
}
