import type { McpOAuthGrant } from '../../../../src/entities/mcp-oauth-grant.entity';
import type { McpOAuthToken } from '../../../../src/entities/mcp-oauth-token.entity';
import { WorkspaceRole } from '../../../../src/entities/workspace-member.entity';
import { refreshVerdict } from '../../../../src/modules/mcp-oauth/refresh-verdict';

const now = new Date('2026-11-09T12:00:00Z');
const clientId = '00000000-0000-4000-8000-000000000001';

const grant = (patch: Partial<McpOAuthGrant> = {}) =>
  ({
    id: 'grant-1',
    clientId,
    grantedRole: WorkspaceRole.MEMBER,
    revokedAt: null,
    ...patch,
  }) as McpOAuthGrant;
const token = (patch: Partial<McpOAuthToken> = {}) =>
  ({
    id: 'token-1',
    kind: 'refresh',
    usedAt: null,
    expiresAt: new Date(now.getTime() + 60_000),
    ...patch,
  }) as McpOAuthToken;
const state = (patch: Partial<Parameters<typeof refreshVerdict>[0]> = {}) => ({
  token: token(),
  grant: grant(),
  memberRole: WorkspaceRole.MEMBER,
  userActive: true,
  clientId,
  now,
  ...patch,
});

describe('refresh token rotation', () => {
  it('rotates a live, unused token of the same client and role', () => {
    expect(refreshVerdict(state()).kind).toBe('rotate');
  });

  it('revokes the whole grant when a rotated token comes back', () => {
    const verdict = refreshVerdict(state({ token: token({ usedAt: new Date(now.getTime() - 1) }) }));
    expect(verdict).toMatchObject({ kind: 'revoke', reason: 'refresh_reuse' });
  });

  it('refuses a disabled account, but a replay still revokes', () => {
    expect(refreshVerdict(state({ userActive: false }))).toMatchObject({ kind: 'refuse' });
    const replay = state({ userActive: false, token: token({ usedAt: new Date(now.getTime() - 1) }) });
    expect(refreshVerdict(replay)).toMatchObject({ kind: 'revoke', reason: 'refresh_reuse' });
  });

  it('revokes when the role changed since consent, either way', () => {
    for (const role of [WorkspaceRole.VIEWER, WorkspaceRole.ADMIN]) {
      expect(refreshVerdict(state({ memberRole: role }))).toMatchObject({
        kind: 'revoke',
        reason: 'role_changed',
      });
    }
    expect(refreshVerdict(state({ memberRole: null }))).toMatchObject({ kind: 'revoke' });
  });

  it('refuses without revoking: unknown, expired, revoked, another client', () => {
    for (const patch of [
      { token: null },
      { grant: null },
      { token: token({ expiresAt: now }) },
      { grant: grant({ revokedAt: now }) },
      { clientId: '00000000-0000-4000-8000-000000000002' },
    ]) {
      expect(refreshVerdict(state(patch)).kind).toBe('refuse');
    }
  });

  it('does not let another client trigger a revocation with a stolen used token', () => {
    const verdict = refreshVerdict(
      state({
        token: token({ usedAt: now }),
        clientId: '00000000-0000-4000-8000-000000000002',
      }),
    );
    expect(verdict.kind).toBe('refuse');
  });
});
