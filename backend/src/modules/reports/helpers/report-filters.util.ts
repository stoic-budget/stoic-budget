import type { SelectQueryBuilder } from 'typeorm';
import { applyOwnerFilter, parseOwnerFilter } from '../../../common/utils/transaction-owner.util';
import { PRIVACY_VIEWER_PARAM, redactedSql } from '../../../common/utils/transaction-privacy.util';
import type { ReportFiltersQuery } from '../../../contracts';
import { type Transaction, TransactionType } from '../../../entities/transaction.entity';

/**
 * The filters top categories and spend over time share, as conditions on a
 * counted-transactions query that has `statement` joined. Merchant and keyword
 * matches read the counterparty as the viewer sees it.
 */
export function applyReportFilters(
  qb: SelectQueryBuilder<Transaction>,
  query: ReportFiltersQuery,
  selfMemberId: string | null,
): void {
  if (query.type === 'income') {
    qb.andWhere('transaction.transactionType = :transactionType', {
      transactionType: TransactionType.INCOME,
    });
  } else if (query.type === 'expense') {
    qb.andWhere('transaction.transactionType = :transactionType', {
      transactionType: TransactionType.EXPENSE,
    });
  }

  if (query.bankName) {
    qb.andWhere('statement.bankName = :bankName', { bankName: query.bankName });
  }

  applyOwnerFilter(qb, 'transaction', parseOwnerFilter(query.owner, selfMemberId));

  if (query.counterparties) {
    const counterparties = query.counterparties
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
    if (counterparties.length > 0) {
      // Matched as the viewer reads it: a merchant filter must not answer
      // yes or no about another member's private row.
      qb.andWhere(
        `${redactedSql('transaction', 'transaction.counterparty_name')} IN (:...counterparties)`,
        { counterparties, [PRIVACY_VIEWER_PARAM]: selfMemberId },
      );
    }
  }

  if (query.statuses) {
    const statuses = query.statuses
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
    if (statuses.length > 0) {
      qb.andWhere('statement.status IN (:...statuses)', { statuses });
    }
  }

  if (query.keywords) {
    const keyword = `%${query.keywords.trim().toLowerCase()}%`;
    qb.andWhere(
      `(LOWER(${redactedSql('transaction', 'transaction.counterparty_name')}) LIKE :keyword OR LOWER(${redactedSql('transaction', 'transaction.payment_purpose')}) LIKE :keyword OR LOWER(statement.fileName) LIKE :keyword OR LOWER(CAST(statement.bankName AS text)) LIKE :keyword)`,
      { keyword, [PRIVACY_VIEWER_PARAM]: selfMemberId },
    );
  }

  if (Number.isFinite(query.amountMin)) {
    qb.andWhere('ABS(COALESCE(transaction.amount, 0)) >= :amountMin', {
      amountMin: query.amountMin,
    });
  }

  if (Number.isFinite(query.amountMax)) {
    qb.andWhere('ABS(COALESCE(transaction.amount, 0)) <= :amountMax', {
      amountMax: query.amountMax,
    });
  }

  if (query.currencies) {
    const currencies = query.currencies
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
    if (currencies.length > 0) {
      qb.andWhere('transaction.currency IN (:...currencies)', { currencies });
    }
  }

  if (typeof query.billable === 'boolean') {
    if (query.billable) {
      qb.andWhere('ABS(COALESCE(transaction.amount, 0)) > 0');
    } else {
      qb.andWhere('ABS(COALESCE(transaction.amount, 0)) <= 0');
    }
  }

  if (typeof query.approved === 'boolean') {
    if (query.approved) {
      qb.andWhere('statement.status IN (:...approvedStatuses)', {
        approvedStatuses: ['validated', 'completed', 'parsed'],
      });
    } else {
      qb.andWhere('statement.status IN (:...notApprovedStatuses)', {
        notApprovedStatuses: ['uploaded', 'processing', 'error'],
      });
    }
  }
}
