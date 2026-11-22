import { BadRequestException, ConflictException, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { appError, type ErrorCode } from '../../../common/errors/app-error';
import { devDefault } from '../../../common/utils/dev-defaults';
import { requireSecret } from '../../../common/utils/required-secret.util';
import type { McpBulkChange } from '../../../contracts';
import type { McpToolContext } from '../mcp-tool';
import { ConfirmReplayStore } from './confirm-replay.store';
import {
  type CallBinding,
  type ConfirmTokenCheck,
  deriveConfirmKey,
  hashArguments,
  hashRows,
  issueConfirmToken,
  type RowsBinding,
  sameRows,
  verifyConfirmToken,
} from './confirm-token';
import type { TransactionChangePlanner } from './transaction-change-planner.service';
import type { ChangePlan } from './transaction-change-rules';

type Refusal = Exclude<ConfirmTokenCheck, { ok: true }>['reason'] | 'used' | 'changed';

const REFUSALS: Record<Refusal, { code: ErrorCode; conflict: boolean }> = {
  invalid: { code: 'MCP_CONFIRM_TOKEN_INVALID', conflict: false },
  expired: { code: 'MCP_CONFIRM_TOKEN_EXPIRED', conflict: false },
  mismatch: { code: 'MCP_CONFIRM_TOKEN_MISMATCH', conflict: false },
  changed: { code: 'MCP_CONFIRM_ROWS_CHANGED', conflict: true },
  used: { code: 'MCP_CONFIRM_TOKEN_USED', conflict: true },
};

const refuse = (reason: Refusal, tool: string): never => {
  const { code, conflict } = REFUSALS[reason];
  const body = appError(code, { tool });
  throw conflict ? new ConflictException(body) : new BadRequestException(body);
};

/** One bulk call: what it would change, worked out now from the database. */
export interface BulkCall {
  tool: string;
  /** The arguments without `confirmToken`. */
  args: Record<string, unknown>;
  confirmToken?: string;
  plan(): Promise<ChangePlan>;
  /** Applies the change to exactly these rows; answers how many changed. */
  apply(ids: string[]): Promise<number>;
}

/** What the bulk transaction tools are built with. */
export interface BulkChangeDeps {
  confirm: McpConfirmService;
  planner: TransactionChangePlanner;
}

/**
 * Preview first, then confirm: a call without a token changes nothing and
 * answers what it would do with a token; the same call with the token applies
 * it, once, within ten minutes, and only while the rows are still the ones
 * the preview showed.
 */
@Injectable()
export class McpConfirmService {
  private key: Buffer | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly used: ConfirmReplayStore,
    @Optional() private readonly dataSource?: DataSource,
  ) {}

  async run(ctx: McpToolContext, call: BulkCall): Promise<McpBulkChange> {
    const caller: CallBinding = {
      tool: call.tool,
      argsHash: hashArguments(call.args),
      workspaceId: ctx.workspaceId,
      apiKeyId: ctx.apiKeyId,
    };
    // A token that cannot be for this call is refused before anything is read.
    const check =
      call.confirmToken === undefined
        ? null
        : verifyConfirmToken(this.signingKey(), call.confirmToken, caller);
    if (check && !check.ok) {
      return refuse(check.reason, call.tool);
    }
    if (!check) {
      const plan = await call.plan();
      return this.preview(caller, this.rowsOf(plan), this.answerOf(call, plan));
    }
    // One confirm at a time per workspace: two tokens previewed on the same
    // rows (say, each into another category) would otherwise both find the
    // rows as previewed and both write, the second over the first.
    return this.oneAtATime(ctx.workspaceId, () => this.confirm(call, check));
  }

  private async confirm(
    call: BulkCall,
    check: Extract<ConfirmTokenCheck, { ok: true }>,
  ): Promise<McpBulkChange> {
    const plan = await call.plan();
    const rows = this.rowsOf(plan);
    const answer = this.answerOf(call, plan);
    // Spent first: once applied, the rows always differ from the preview.
    if (await this.used.isUsed(check.jti)) {
      return refuse('used', call.tool);
    }
    if (!sameRows(check.previewed, rows)) {
      return refuse('changed', call.tool);
    }
    // Claimed before the write, so two confirms racing each other apply once.
    if (!(await this.used.claim(check.jti, Math.max(check.expiresAt - Date.now(), 1000)))) {
      return refuse('used', call.tool);
    }
    const changed = await call.apply(plan.rows.map(row => row.id));
    return {
      status: 'applied',
      rows: changed,
      ...answer,
      next: 'Applied. Each change is logged as this API key and can be undone from the activity log.',
    };
  }

  private rowsOf(plan: ChangePlan): RowsBinding {
    return { rowsHash: hashRows(plan.rows), rows: plan.rows.length };
  }

  private answerOf(call: BulkCall, plan: ChangePlan) {
    return { tool: call.tool, skipped: plan.skipped, examples: plan.examples };
  }

  /** Runs `work` holding a lock per workspace; without a database (unit tests), as is. */
  private async oneAtATime<T>(workspaceId: string, work: () => Promise<T>): Promise<T> {
    if (!this.dataSource) {
      return work();
    }
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    const key = `mcp-confirm:${workspaceId}`;
    try {
      await runner.query('SELECT pg_advisory_lock(hashtext($1))', [key]);
      return await work();
    } finally {
      await runner.query('SELECT pg_advisory_unlock(hashtext($1))', [key]).catch(() => undefined);
      await runner.release();
    }
  }

  private preview(
    caller: CallBinding,
    rows: RowsBinding,
    answer: Pick<McpBulkChange, 'tool' | 'skipped' | 'examples'>,
  ): McpBulkChange {
    if (rows.rows === 0) {
      return {
        status: 'preview',
        rows: 0,
        ...answer,
        next: 'Nothing to change: every row is skipped, so there is nothing to confirm.',
      };
    }
    const { token, expiresAt } = issueConfirmToken(this.signingKey(), { ...caller, ...rows });
    return {
      status: 'preview',
      rows: rows.rows,
      ...answer,
      confirmToken: token,
      expiresAt: new Date(expiresAt).toISOString(),
      next: `Nothing has changed yet. To apply, call ${caller.tool} again with the same arguments plus this confirmToken, within 10 minutes.`,
    };
  }

  // Derived on first use: a server that never confirms needs no secret for it.
  private signingKey(): Buffer {
    this.key ??= deriveConfirmKey(
      requireSecret(
        'MCP_CONFIRM_SECRET or JWT_SECRET',
        this.config.get<string>('MCP_CONFIRM_SECRET') ||
          devDefault(this.config.get<string>('JWT_SECRET'), 'JWT_SECRET'),
      ),
    );
    return this.key;
  }
}
