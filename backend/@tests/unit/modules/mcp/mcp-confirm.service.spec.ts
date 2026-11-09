import { BadRequestException, ConflictException } from '@nestjs/common';
import type { ConfirmReplayStore } from '@/modules/mcp/confirm/confirm-replay.store';
import { type BulkCall, McpConfirmService } from '@/modules/mcp/confirm/mcp-confirm.service';
import type { ChangePlan } from '@/modules/mcp/confirm/transaction-change-rules';
import type { McpToolContext } from '@/modules/mcp/mcp-tool';

const ctx = { workspaceId: 'workspace-1', apiKeyId: 'key-1' } as McpToolContext;
const config = {
  get: (name: string) => (name === 'MCP_CONFIRM_SECRET' ? 'confirm-secret' : undefined),
};

/** Redis SET NX, in memory. */
const replayStore = () => {
  const claimed = new Set<string>();
  return {
    isUsed: vi.fn(async (jti: string) => claimed.has(jti)),
    claim: vi.fn(async (jti: string) => {
      if (claimed.has(jti)) return false;
      claimed.add(jti);
      return true;
    }),
  };
};

const planOf = (ids: string[], state = 'cat-1|0'): ChangePlan => ({
  rows: ids.map(id => ({ id, state })),
  skipped: [{ reason: 'not_found', ids: ['gone'] }],
  examples: [],
});

describe('McpConfirmService', () => {
  let store: ReturnType<typeof replayStore>;
  let service: McpConfirmService;
  let plan: ChangePlan;
  const apply = vi.fn(async (ids: string[]) => ids.length);
  const planned = vi.fn(async () => plan);
  const call = (confirmToken?: string, args: Record<string, unknown> = { ids: ['a', 'b'] }): BulkCall => ({
    tool: 'approve_transactions',
    args,
    confirmToken,
    plan: planned,
    apply,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    store = replayStore();
    service = new McpConfirmService(config as never, store as unknown as ConfirmReplayStore);
    plan = planOf(['a', 'b']);
  });

  it('previews without applying, then applies the previewed rows once', async () => {
    const preview = await service.run(ctx, call());

    expect(apply).not.toHaveBeenCalled();
    expect(preview).toMatchObject({ status: 'preview', rows: 2, skipped: plan.skipped });
    expect(preview.confirmToken).toMatch(/^mcpc1\./);
    expect(Date.parse(preview.expiresAt ?? '')).toBeGreaterThan(Date.now());

    const applied = await service.run(ctx, call(preview.confirmToken));
    expect(apply).toHaveBeenCalledWith(['a', 'b']);
    expect(applied).toMatchObject({ status: 'applied', rows: 2 });
    expect(applied.confirmToken).toBeUndefined();

    // Applied, the rows no longer match the preview; the token still reads as spent.
    plan = planOf([]);
    await expect(service.run(ctx, call(preview.confirmToken))).rejects.toMatchObject({
      response: { code: 'MCP_CONFIRM_TOKEN_USED' },
    });
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('applies once when two confirms race', async () => {
    const { confirmToken } = await service.run(ctx, call());

    const results = await Promise.allSettled([
      service.run(ctx, call(confirmToken)),
      service.run(ctx, call(confirmToken)),
    ]);

    expect(results.map(result => result.status).sort()).toEqual(['fulfilled', 'rejected']);
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('issues no token when nothing would change', async () => {
    plan = planOf([]);

    const preview = await service.run(ctx, call());

    expect(preview).toMatchObject({ status: 'preview', rows: 0 });
    expect(preview.confirmToken).toBeUndefined();
  });

  it('refuses a token once the rows it would change are not the previewed ones', async () => {
    const { confirmToken } = await service.run(ctx, call());
    plan = planOf(['a', 'b'], 'cat-2|0');

    const refused = service.run(ctx, call(confirmToken));

    await expect(refused).rejects.toThrow(ConflictException);
    await expect(refused).rejects.toMatchObject({
      response: { code: 'MCP_CONFIRM_ROWS_CHANGED', params: { tool: 'approve_transactions' } },
    });
    expect(apply).not.toHaveBeenCalled();
    expect(store.claim).not.toHaveBeenCalled();
  });

  it('refuses a token for other arguments, another workspace or key, and a garbled one', async () => {
    const { confirmToken } = await service.run(ctx, call());
    const refusals = [
      [call(confirmToken, { ids: ['a', 'b'], categoryId: 'cat-9' }), ctx, 'MCP_CONFIRM_TOKEN_MISMATCH'],
      [call(confirmToken), { ...ctx, workspaceId: 'workspace-2' }, 'MCP_CONFIRM_TOKEN_INVALID'],
      [call(confirmToken), { ...ctx, apiKeyId: 'key-2' }, 'MCP_CONFIRM_TOKEN_INVALID'],
      [call('garbled'), ctx, 'MCP_CONFIRM_TOKEN_INVALID'],
    ] as const;

    for (const [attempt, caller, code] of refusals) {
      await expect(service.run(caller as McpToolContext, attempt)).rejects.toMatchObject({
        response: { code },
      });
    }
    await expect(service.run(ctx, call('garbled'))).rejects.toThrow(BadRequestException);
    expect(apply).not.toHaveBeenCalled();
    // Refused before the database is read: only the preview planned.
    expect(planned).toHaveBeenCalledTimes(1);
  });

  it('refuses an expired token', async () => {
    vi.useFakeTimers({ now: Date.UTC(2026, 10, 9, 12) });
    try {
      const { confirmToken } = await service.run(ctx, call());
      vi.setSystemTime(Date.UTC(2026, 10, 9, 12, 10, 1));

      await expect(service.run(ctx, call(confirmToken))).rejects.toMatchObject({
        response: { code: 'MCP_CONFIRM_TOKEN_EXPIRED' },
      });
    } finally {
      vi.useRealTimers();
    }
    expect(apply).not.toHaveBeenCalled();
  });

  it('remembers a spent token only until it would have expired anyway', async () => {
    const { confirmToken } = await service.run(ctx, call());
    await service.run(ctx, call(confirmToken));

    const ttl = store.claim.mock.calls[0][1];
    expect(ttl).toBeGreaterThan(9 * 60 * 1000);
    expect(ttl).toBeLessThanOrEqual(10 * 60 * 1000);
  });
});
