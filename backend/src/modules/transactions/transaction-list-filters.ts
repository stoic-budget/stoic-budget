import type { SelectQueryBuilder } from 'typeorm';
import { type OwnerFilter, parseOwnerFilter } from '../../common/utils/transaction-owner.util';
import type { PaymentType, TransactionListQuery } from '../../contracts';
import type { Transaction } from '../../entities/transaction.entity';
import {
  awaitingCategorySql,
  UNCATEGORIZED_SQL_PARAMS,
} from '../categories/uncategorized-category';
import { AMOUNT_SQL } from '../payees/payee-flows';
import { TRANSACTION_TAG_PAIRS_SQL } from '../tags/transaction-tag-pairs.util';

/** What `GET /transactions` narrows the list by. */
export interface TransactionListFilters {
  statementId?: string;
  walletId?: string;
  payeeId?: string;
  paymentType?: PaymentType;
  dateFrom?: Date;
  dateTo?: Date;
  type?: string;
  categoryId?: string;
  currency?: string;
  convertTo?: string;
  owner?: OwnerFilter;
  /** Text in the payee, the counterparty, the purpose or the comment. */
  q?: string;
  amountMin?: number;
  amountMax?: number;
  tagIds?: string[];
  categoryIds?: string[];
  uncategorized?: boolean;
  untagged?: boolean;
  noPayee?: boolean;
  page?: number;
  limit?: number;
}

/** `GET /transactions` query to filters; the snake_case spelling wins, the camelCase one is the fallback. */
export function listFiltersFromQuery(
  query: TransactionListQuery,
  selfMemberId: string | null,
): TransactionListFilters {
  const dateFrom = query.date_from || query.startDate;
  const dateTo = query.date_to || query.endDate;
  return {
    statementId: query.statement_id || query.statementId,
    walletId: query.walletId,
    payeeId: query.payeeId,
    paymentType: query.paymentType,
    dateFrom: dateFrom ? new Date(dateFrom) : undefined,
    dateTo: dateTo ? new Date(dateTo) : undefined,
    type: query.type,
    categoryId: query.category_id || query.categoryId,
    currency: query.currency,
    convertTo: query.convert_to,
    owner: parseOwnerFilter(query.owner, selfMemberId),
    q: query.q?.trim() || undefined,
    amountMin: query.amountMin,
    amountMax: query.amountMax,
    tagIds: query.tagIds?.length ? [...query.tagIds] : undefined,
    categoryIds: query.categoryIds?.length ? [...query.categoryIds] : undefined,
    uncategorized: query.uncategorized,
    untagged: query.untagged,
    noPayee: query.noPayee,
    page: query.page ?? 1,
    limit: query.limit ?? 50,
  };
}

/** `value` matched literally inside LIKE: its `\`, `%` and `_` lose their meaning. */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, match => `\\${match}`);
}

/** Rows the viewer may read as they are: anyone's but another member's private ones. */
const READABLE_SQL =
  '(transaction.isPrivate = false OR transaction.ownerMemberId = :viewerMemberId)';

/** The transactions carrying a tag, however they got it, scoped to the list's workspace. */
const TAGGED_SQL = `SELECT tag_pairs.transaction_id FROM (${TRANSACTION_TAG_PAIRS_SQL}) tag_pairs`;

/** The list's filters other than the owner, on a query aliased `transaction` with `payee` joined. */
export function applyListFilters(
  query: SelectQueryBuilder<Transaction>,
  filters: TransactionListFilters,
  viewerMemberId: string | null = null,
): void {
  if (filters.statementId) {
    query.andWhere('transaction.statementId = :statementId', {
      statementId: filters.statementId,
    });
  }

  if (filters.walletId) {
    query.andWhere('transaction.walletId = :walletId', { walletId: filters.walletId });
  }

  if (filters.payeeId) {
    query.andWhere('transaction.payeeId = :payeeId', { payeeId: filters.payeeId });
  }

  if (filters.paymentType) {
    query.andWhere('transaction.paymentType = :paymentType', {
      paymentType: filters.paymentType,
    });
    // Another member's private row hides its type, so the filter must not reveal it either.
    query.andWhere(READABLE_SQL, { viewerMemberId });
  }

  if (filters.dateFrom) {
    query.andWhere('transaction.transactionDate >= :dateFrom', {
      dateFrom: filters.dateFrom,
    });
  }

  if (filters.dateTo) {
    query.andWhere('transaction.transactionDate <= :dateTo', {
      dateTo: filters.dateTo,
    });
  }

  if (filters.type === 'transfer') {
    query.andWhere('transaction.transferPairId IS NOT NULL');
  } else if (filters.type) {
    query.andWhere('transaction.transactionType = :type', { type: filters.type });
  }

  if (filters.categoryId) {
    query.andWhere('transaction.categoryId = :categoryId', {
      categoryId: filters.categoryId,
    });
  }

  if (filters.currency) {
    query.andWhere('UPPER(transaction.currency) = :currency', {
      currency: filters.currency.toUpperCase(),
    });
  }

  applySearchFilters(query, filters, viewerMemberId);
}

/** Text, amount, tags, several categories and the "missing" toggles. */
function applySearchFilters(
  query: SelectQueryBuilder<Transaction>,
  filters: TransactionListFilters,
  viewerMemberId: string | null,
): void {
  if (filters.q) {
    // Another member's private row reads as a placeholder, so its text must not match either.
    query.andWhere(
      `(${READABLE_SQL} AND (transaction.counterpartyName ILIKE :q OR transaction.paymentPurpose ILIKE :q OR transaction.comments ILIKE :q OR payee.name ILIKE :q))`,
      { q: `%${escapeLikePattern(filters.q)}%`, viewerMemberId },
    );
  }

  if (filters.amountMin !== undefined) {
    query.andWhere(`${AMOUNT_SQL} >= :amountMin`, { amountMin: filters.amountMin });
  }

  if (filters.amountMax !== undefined) {
    query.andWhere(`${AMOUNT_SQL} <= :amountMax`, { amountMax: filters.amountMax });
  }

  if (filters.categoryIds?.length) {
    query.andWhere('transaction.categoryId IN (:...categoryIds)', {
      categoryIds: filters.categoryIds,
    });
  }

  if (filters.uncategorized) {
    query.andWhere(awaitingCategorySql('transaction'), UNCATEGORIZED_SQL_PARAMS);
  }

  // The tag pairs read the workspace from the `:workspaceId` the list is scoped by.
  if (filters.tagIds?.length) {
    query.andWhere(`transaction.id IN (${TAGGED_SQL} WHERE tag_pairs.tag_id IN (:...tagIds))`, {
      tagIds: filters.tagIds,
    });
  }

  if (filters.untagged) {
    query.andWhere(`transaction.id NOT IN (${TAGGED_SQL})`);
  }

  if (filters.noPayee) {
    // Another member's private row hides its payee, so it is left out rather than told apart.
    query.andWhere(`(transaction.payeeId IS NULL AND ${READABLE_SQL})`, { viewerMemberId });
  }
}
