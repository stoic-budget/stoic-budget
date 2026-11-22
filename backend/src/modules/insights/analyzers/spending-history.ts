import type { Repository } from 'typeorm';
import { flowsSql } from '../../../common/utils/counted-transactions.util';
import { type Transaction, TransactionType } from '../../../entities/transaction.entity';
import type { Workspace } from '../../../entities/workspace.entity';
import { isPrivateCategoryName } from '../../categories/private-category';
import { UNCATEGORIZED_CATEGORY_NAME } from '../../categories/uncategorized-category';
import type { ExchangeRatesService } from '../../exchange-rates/exchange-rates.service';
import { toDateOnly } from '../../goals/goal-money.util';
import { monthBounds, monthsBetween } from './month-bounds';
import type { CategoryHistory } from './wealth-signals';
import { workspaceMoney } from './workspace-money';

/** How many full months before the current one the baselines are read over. */
export const HISTORY_MONTHS = 6;

export interface SpendingHistory {
  currency: string;
  /**
   * Everything spent in each full month of the baseline, newest first, in the
   * workspace currency. Only the unbroken run of months the workspace has
   * data for from their first day; see `observedMonths`.
   */
  household: number[];
  /** Per category: the current month so far and the same baseline months. */
  categories: CategoryHistory[];
}

/**
 * A private row has no category anyone else may see: the bucket is null, so
 * its money counts in the household's total but in no category's.
 */
const BUCKET_ID = 'CASE WHEN t.is_private THEN NULL ELSE t.category_id END';
const BUCKET_NAME = 'CASE WHEN t.is_private THEN NULL ELSE category.name END';
const MONTH = "date_trunc('month', t.transaction_date)";

interface Deps {
  transactionRepository: Repository<Transaction>;
  workspaceRepository: Repository<Workspace>;
  exchangeRatesService: ExchangeRatesService;
}

/**
 * Counted spending (confirmed, not a duplicate, not a transfer between own
 * accounts) for the current month and the `HISTORY_MONTHS` before it, by
 * category and in total.
 */
export async function loadSpendingHistory(
  deps: Deps,
  workspaceId: string,
  now: Date,
): Promise<SpendingHistory> {
  const [rows, coverage] = await Promise.all([
    loadRows(deps.transactionRepository, workspaceId, now),
    monthlyCoverage(deps.transactionRepository, workspaceId, now),
  ]);
  const { currency, convert } = await workspaceMoney(
    deps.workspaceRepository,
    deps.exchangeRatesService,
    workspaceId,
    rows,
  );

  const observed = observedMonths(coverage, now);
  const household = new Array<number>(observed).fill(0);
  const categories = new Map<string, CategoryHistory & { baseline: number[] }>();
  for (const row of rows) {
    const monthIndex = monthsBetween(new Date(row.month), now);
    if (monthIndex < 0 || monthIndex > observed) {
      continue;
    }
    const amount = convert(row, row.total);
    if (monthIndex > 0) {
      household[monthIndex - 1] += amount;
    }
    if (!(row.categoryId && isNamedCategory(row.categoryName))) {
      continue;
    }
    const entry = categories.get(row.categoryId) ?? {
      categoryId: row.categoryId,
      categoryName: row.categoryName ?? '',
      current: 0,
      baseline: new Array<number>(observed).fill(0),
    };
    if (monthIndex === 0) {
      entry.current += amount;
    } else {
      entry.baseline[monthIndex - 1] += amount;
    }
    categories.set(row.categoryId, entry);
  }

  return { currency, household, categories: [...categories.values()] };
}

/**
 * Full months before the current one, counted back without a break, that the
 * workspace has data for from their first day. A month with no counted row
 * at all is missing data, not a month of no spending: an old receipt followed
 * by a pause would otherwise read as a long, cheap history. A month counts
 * when the month before it has data too, or when its own data starts on the
 * 1st; a month the data begins halfway through would read as a cheap one.
 */
function observedMonths(coverage: Map<number, string>, now: Date): number {
  let observed = 0;
  while (observed < HISTORY_MONTHS) {
    const monthsAgo = observed + 1;
    const first = coverage.get(monthsAgo);
    const fromItsFirstDay =
      first !== undefined &&
      (coverage.has(monthsAgo + 1) || first <= toDateOnly(monthBounds(now, monthsAgo).start));
    if (!fromItsFirstDay) {
      break;
    }
    observed += 1;
  }
  return observed;
}

/** The rows waiting for a category and the private ones say nothing about any one category. */
function isNamedCategory(name: string | null): boolean {
  return (
    !!name &&
    name.trim().toLowerCase() !== UNCATEGORIZED_CATEGORY_NAME.toLowerCase() &&
    !isPrivateCategoryName(name)
  );
}

function loadRows(repository: Repository<Transaction>, workspaceId: string, now: Date) {
  return repository
    .createQueryBuilder('t')
    .leftJoin('t.category', 'category')
    .select(BUCKET_ID, 'categoryId')
    .addSelect(BUCKET_NAME, 'categoryName')
    .addSelect(MONTH, 'month')
    .addSelect('t.currency', 'currency')
    .addSelect('COALESCE(SUM(ABS(t.amount)), 0)', 'total')
    .where('t.workspace_id = :workspaceId', { workspaceId })
    .andWhere('t.transaction_type = :type', { type: TransactionType.EXPENSE })
    .andWhere('t.transaction_date >= :start', { start: monthBounds(now, HISTORY_MONTHS).start })
    .andWhere('t.transaction_date <= :end', { end: monthBounds(now, 0).end })
    .andWhere('t.is_duplicate = false')
    .andWhere('t.transfer_pair_id IS NULL')
    .andWhere(flowsSql('t'))
    .groupBy(BUCKET_ID)
    .addGroupBy(BUCKET_NAME)
    .addGroupBy(MONTH)
    .addGroupBy('t.currency')
    .getRawMany<{
      categoryId: string | null;
      categoryName: string | null;
      month: string | Date;
      currency: string | null;
      total: string;
    }>();
}

/**
 * For each of the full months the baseline could reach, plus the one before
 * it, the first day it has a counted row on (`YYYY-MM-DD`), keyed by how many
 * months before `now` it is. Months without any are absent.
 */
async function monthlyCoverage(
  repository: Repository<Transaction>,
  workspaceId: string,
  now: Date,
): Promise<Map<number, string>> {
  const rows = await repository
    .createQueryBuilder('t')
    .select(MONTH, 'month')
    .addSelect('MIN(t.transaction_date)', 'first')
    .where('t.workspace_id = :workspaceId', { workspaceId })
    .andWhere('t.transaction_date >= :start', { start: monthBounds(now, HISTORY_MONTHS + 1).start })
    .andWhere('t.transaction_date <= :end', { end: monthBounds(now, 1).end })
    .andWhere(flowsSql('t'))
    .groupBy(MONTH)
    .getRawMany<{ month: string | Date; first: string | Date }>();
  return new Map(
    rows.map(row => [
      monthsBetween(new Date(row.month), now),
      row.first instanceof Date ? toDateOnly(row.first) : String(row.first).slice(0, 10),
    ]),
  );
}
