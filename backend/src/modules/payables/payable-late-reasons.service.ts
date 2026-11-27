import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { addDays, formatDay } from '../../common/recurrence/date-only';
import { assertFound } from '../../common/utils/assert-found.util';
import type { LatePaymentsSummary, LateReason, SetPayableLateReasonBody } from '../../contracts';
import { Payable, PayableDirection } from '../../entities/payable.entity';
import { PayablesService } from './payables.service';

/** The summary looks back this far, by due date. */
export const SUMMARY_DAYS = 365;

/**
 * SQL, for a bill aliased `p`: it was paid late or is still unpaid past its
 * due date. A payment dated after the due date, or the bill marked paid after
 * it, is late; so is a reason already given. Receivables are owed to the
 * workspace, not by it: none of them is ever late in this sense.
 */
export const LATE_SQL = `p."direction" = 'payable' AND p."due_date" IS NOT NULL
  AND (p."late_reason" IS NOT NULL
    OR (p."status" NOT IN ('paid', 'archived') AND p."skipped_at" IS NULL
        AND p."due_date" < CURRENT_DATE)
    OR (p."status" = 'paid' AND p."paid_at"::date > p."due_date")
    OR EXISTS (SELECT 1 FROM "payable_payments" pp
                WHERE pp."payable_id" = p."id" AND pp."paid_on" > p."due_date"))`;

/**
 * Why a bill was paid late, as the person says it, and what those reasons
 * add up to over a year. Only a bill to pay that is (or was) late takes one;
 * taking it back is always allowed.
 */
@Injectable()
export class PayableLateReasonsService {
  constructor(
    @InjectRepository(Payable) private readonly payables: Repository<Payable>,
    private readonly payablesService: PayablesService,
  ) {}

  async set(id: string, workspaceId: string, body: SetPayableLateReasonBody): Promise<Payable> {
    const payable = await this.payables.findOne({
      where: { id, workspaceId },
      select: { id: true, direction: true },
    });
    assertFound(payable, 'Payable');
    if (body.reason !== null) {
      if (payable.direction !== PayableDirection.PAYABLE) {
        throw new BadRequestException(appError('PAYABLE_LATE_REASON_PAYABLES_ONLY'));
      }
      const [late]: Array<{ late: boolean }> = await this.payables.query(
        `SELECT (${LATE_SQL}) AS "late" FROM "payables" p WHERE p."id" = $1 AND p."workspace_id" = $2`,
        [id, workspaceId],
      );
      if (!late?.late) {
        throw new BadRequestException(appError('PAYABLE_NOT_LATE'));
      }
    }
    const note = body.reason === null ? null : body.note?.trim() || null;
    await this.payables.update(
      { id, workspaceId },
      { lateReason: body.reason, lateReasonNote: note },
    );
    return this.payablesService.findOne(id, workspaceId);
  }

  async summary(workspaceId: string, today = formatDay(new Date())): Promise<LatePaymentsSummary> {
    const since = addDays(today, -SUMMARY_DAYS);
    const rows: Array<{ reason: LateReason | null; count: string }> = await this.payables.query(
      `SELECT p."late_reason" AS "reason", count(*)::text AS "count"
         FROM "payables" p
        WHERE p."workspace_id" = $1 AND p."deleted_at" IS NULL
          AND p."due_date" >= $2::date AND p."due_date" < $3::date AND ${LATE_SQL}
        GROUP BY p."late_reason"`,
      [workspaceId, since, today],
    );
    const byReason = rows
      .filter((row): row is { reason: LateReason; count: string } => row.reason !== null)
      .map(row => ({ reason: row.reason, count: Number(row.count) }))
      .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));
    const unexplained = Number(rows.find(row => row.reason === null)?.count ?? 0);
    return {
      since,
      total: unexplained + byReason.reduce((sum, row) => sum + row.count, 0),
      unexplained,
      byReason,
    };
  }
}
