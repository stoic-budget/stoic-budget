import {
  canReadPrivate,
  PRIVATE_PLACEHOLDER,
} from '../../../common/utils/transaction-privacy.util';
import type { McpChangeExample, McpRowState, McpSkippedRows } from '../../../contracts';

/** How many changed rows a preview spells out. */
export const PREVIEW_EXAMPLES = 5;

/** What a bulk transaction tool asks for: a category for every row, approval, or both. */
export interface TransactionChange {
  /** Omitted leaves each row's category; null clears it. */
  categoryId?: string | null;
  approve?: boolean;
}

/** The columns a plan reads, as the database hands them over. */
export interface PlannedRow {
  id: string;
  transactionDate: string | Date;
  amount: string | number | null;
  currency: string;
  counterpartyName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  isVerified: boolean;
  taxLocked: boolean;
  isPrivate: boolean;
  ownerMemberId: string | null;
}

/** The rows a bulk call changes, each with the state the preview showed, and the rest by reason. */
export interface ChangePlan {
  rows: Array<{ id: string; state: string }>;
  skipped: McpSkippedRows[];
  examples: McpChangeExample[];
}

type SkipReason = McpSkippedRows['reason'];
const REASONS: SkipReason[] = ['not_found', 'unchanged', 'private', 'tax_locked'];

const dayOf = (value: string | Date): string =>
  value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);

/**
 * Why a row would be left alone, or null when the call changes it. Mirrors what
 * `TransactionsService.update` would do, so the preview never promises a row
 * the write would then refuse.
 */
function skipReason(
  row: PlannedRow,
  change: TransactionChange,
  viewerMemberId: string | null,
): SkipReason | null {
  const recategorises = change.categoryId !== undefined && change.categoryId !== row.categoryId;
  const approves = change.approve === true && !row.isVerified;
  if (!(recategorises || approves)) {
    return 'unchanged';
  }
  // Which category another member's private row had is theirs to decide.
  if (recategorises && !canReadPrivate(row, viewerMemberId)) {
    return 'private';
  }
  // A filed return freezes the category; the update refuses any category in the body.
  if (change.categoryId !== undefined && row.taxLocked) {
    return 'tax_locked';
  }
  return null;
}

const stateOf = (row: PlannedRow): McpRowState => ({
  categoryId: row.categoryId,
  categoryName: row.categoryName,
  approved: row.isVerified,
});

export function planTransactionChange(
  ids: readonly string[],
  rows: readonly PlannedRow[],
  change: TransactionChange,
  target: { name: string | null },
  viewerMemberId: string | null,
): ChangePlan {
  const byId = new Map(rows.map(row => [row.id, row]));
  const skipped = new Map<SkipReason, string[]>();
  const changed: PlannedRow[] = [];
  // Postgres matches a uuid in any case but hands it back in lower case.
  for (const id of new Set(ids.map(id => id.toLowerCase()))) {
    const row = byId.get(id);
    const reason = row ? skipReason(row, change, viewerMemberId) : 'not_found';
    if (reason) {
      skipped.set(reason, [...(skipped.get(reason) ?? []), id]);
    } else if (row) {
      changed.push(row);
    }
  }
  return {
    rows: changed.map(row => ({
      id: row.id,
      state: `${row.categoryId ?? '-'}|${row.isVerified ? 1 : 0}`,
    })),
    skipped: REASONS.filter(reason => skipped.has(reason)).map(reason => ({
      reason,
      ids: skipped.get(reason) ?? [],
    })),
    examples: changed.slice(0, PREVIEW_EXAMPLES).map(row => {
      const before = stateOf(row);
      const recategorised = change.categoryId !== undefined;
      return {
        id: row.id,
        date: dayOf(row.transactionDate),
        amount: row.amount === null ? null : String(row.amount),
        currency: row.currency,
        counterparty: canReadPrivate(row, viewerMemberId)
          ? row.counterpartyName
          : PRIVATE_PLACEHOLDER,
        before,
        after: {
          categoryId: recategorised ? (change.categoryId ?? null) : before.categoryId,
          categoryName: recategorised ? target.name : before.categoryName,
          approved: change.approve === true ? true : before.approved,
        },
      };
    }),
  };
}
