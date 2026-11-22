import type { McpOAuthGrant } from '../../entities/mcp-oauth-grant.entity';
import type { McpOAuthToken } from '../../entities/mcp-oauth-token.entity';
import type { WorkspaceRole } from '../../entities/workspace-member.entity';

export type RefreshVerdict =
  | { kind: 'rotate'; token: McpOAuthToken; grant: McpOAuthGrant }
  | { kind: 'refuse'; description: string }
  | { kind: 'revoke'; reason: 'refresh_reuse' | 'role_changed'; description: string };

export interface RefreshState {
  token: McpOAuthToken | null;
  grant: McpOAuthGrant | null;
  /** The person's role in the grant's workspace now; null when they left it. */
  memberRole: WorkspaceRole | null;
  /** Whether the person's account is still active; a disabled one gets no new tokens. */
  userActive: boolean;
  clientId: string;
  now: Date;
}

/**
 * What a refresh request earns. A refresh token that was already rotated is a
 * copy in someone else's hands: the grant goes, for the thief and the client
 * alike (OAuth 2.1 §4.3.1). A role other than the one consent was given under
 * ends the grant too; the person can approve again under the new role.
 */
export function refreshVerdict({
  token,
  grant,
  memberRole,
  userActive,
  clientId,
  now,
}: RefreshState): RefreshVerdict {
  if (!(token && grant) || grant.revokedAt) {
    return { kind: 'refuse', description: 'Unknown or revoked refresh token' };
  }
  if (grant.clientId !== clientId) {
    return { kind: 'refuse', description: 'The refresh token was issued to another client' };
  }
  if (token.usedAt) {
    return {
      kind: 'revoke',
      reason: 'refresh_reuse',
      description: 'The refresh token was already used; the grant is revoked',
    };
  }
  if (token.expiresAt <= now) {
    return { kind: 'refuse', description: 'The refresh token has expired' };
  }
  if (!userActive) {
    return { kind: 'refuse', description: 'The account is disabled' };
  }
  if (memberRole !== grant.grantedRole) {
    return {
      kind: 'revoke',
      reason: 'role_changed',
      description: 'Your access to the workspace has changed',
    };
  }
  return { kind: 'rotate', token, grant };
}
