import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { addDays, formatDay } from '../../../common/recurrence/date-only';
import type { LateReason } from '../../../contracts';
import { InsightCategory, InsightSeverity, InsightType } from '../../../entities/insight.entity';
import { Payable } from '../../../entities/payable.entity';
import { LATE_SQL } from '../../payables/late-sql';
import { STOIC_VARIANT_COUNT } from '../stoic-texts/types';
import type { AnalysisContext, InsightAnalyzer, InsightCandidate } from './analyzer.interface';
import { hash, rotation } from './stoic-rotation';

/** How far back the reasons are read, by due date. */
export const LATE_WINDOW_DAYS = 183;
/** Once is chance; this many times is a habit worth a word. */
export const LATE_HABIT_COUNT = 2;

type LateAdviceKey = 'stoic.late_forgot' | 'stoic.late_short' | 'stoic.late_unexpected';

interface LateAdvice {
  key: LateAdviceKey;
  reasons: readonly LateReason[];
  /** Where the card leads: the bills (to remind earlier, to move a date) or the goals (a reserve). */
  target: 'bills' | 'goals';
  priority: number;
}

/** The reasons that point at something to change, and what. */
export const LATE_ADVICE: readonly LateAdvice[] = [
  { key: 'stoic.late_forgot', reasons: ['forgot'], target: 'bills', priority: 34 },
  {
    key: 'stoic.late_short',
    reasons: ['short_before_payday', 'income_late'],
    target: 'bills',
    priority: 36,
  },
  {
    key: 'stoic.late_unexpected',
    reasons: ['unexpected_expense'],
    target: 'goals',
    priority: 33,
  },
];

/** The advice the counted reasons call for; a pure function, so the rules are tested alone. */
export function lateAdviceFor(counts: Partial<Record<LateReason, number>>) {
  return LATE_ADVICE.flatMap(advice => {
    const count = advice.reasons.reduce((sum, reason) => sum + (counts[reason] ?? 0), 0);
    return count >= LATE_HABIT_COUNT ? [{ advice, count }] : [];
  });
}

/**
 * Advice from the reasons people gave for paying late: the same reason twice
 * in half a year is a habit, and each habit has its remedy. Bank trouble and
 * "other" call for none: they are not the person's to change.
 */
@Injectable()
export class LatePaymentsAnalyzer implements InsightAnalyzer {
  constructor(@InjectRepository(Payable) private readonly payables: Repository<Payable>) {}

  async analyze(context: AnalysisContext, now = new Date()): Promise<InsightCandidate[]> {
    const workspaceId = context.workspaceId;
    if (!workspaceId) return [];
    const today = formatDay(now);
    const rows: Array<{ reason: LateReason; count: string }> = await this.payables.query(
      `SELECT p."late_reason" AS "reason", count(*)::text AS "count"
         FROM "payables" p
        WHERE p."workspace_id" = $1 AND p."deleted_at" IS NULL AND p."direction" = 'payable'
          AND p."late_reason" IS NOT NULL AND ${LATE_SQL}
          AND p."due_date" >= $2::date AND p."due_date" <= $3::date
        GROUP BY p."late_reason"`,
      [workspaceId, addDays(today, -LATE_WINDOW_DAYS), today],
    );
    const counts = Object.fromEntries(rows.map(row => [row.reason, Number(row.count)]));
    return lateAdviceFor(counts).map(({ advice, count }) => ({
      type: InsightType.LATE_PAYMENTS,
      category: InsightCategory.PATTERN,
      severity: InsightSeverity.INFO,
      messageKey: advice.key,
      // Five wordings each, as for the Stoic advice: the same habit does not read the same way twice.
      messageParams: {
        count,
        variant: (rotation(workspaceId, now) + hash(advice.key)) % STOIC_VARIANT_COUNT,
      },
      deduplicationKey: `financial:${advice.key}:${workspaceId}`,
      data: { priority: advice.priority, target: advice.target, count },
    }));
  }
}
