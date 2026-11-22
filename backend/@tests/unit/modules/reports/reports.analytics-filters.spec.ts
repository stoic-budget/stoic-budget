import { redactedSql } from '@/common/utils/transaction-privacy.util';
import { TransactionType } from '@/entities/transaction.entity';
import { buildReportsService } from './helpers/build-reports-service';

// Characterization tests: they pin the conditions the two analytics reports
// add for each filter, so sharing that code cannot change it unnoticed.

const WS_ID = 'ws-analytics';
const SELF = 'member-1';
const counterpartySql = redactedSql('transaction', 'transaction.counterparty_name');
const keywordSql = `(LOWER(${counterpartySql}) LIKE :keyword OR LOWER(${redactedSql('transaction', 'transaction.payment_purpose')}) LIKE :keyword OR LOWER(statement.fileName) LIKE :keyword OR LOWER(CAST(statement.bankName AS text)) LIKE :keyword)`;

/** Records every `andWhere` after the date range, i.e. the filters the request asked for. */
function recordingService() {
  const calls: Array<[string, unknown]> = [];
  const qb: any = {};
  for (const method of [
    'where',
    'leftJoin',
    'leftJoinAndSelect',
    'select',
    'addSelect',
    'groupBy',
    'orderBy',
    'take',
  ]) {
    qb[method] = vi.fn().mockReturnValue(qb);
  }
  qb.andWhere = vi.fn((sql: string, params?: unknown) => {
    calls.push([sql, params]);
    return qb;
  });
  qb.getMany = vi.fn().mockResolvedValue([]);
  qb.getRawMany = vi.fn().mockResolvedValue([]);
  const service = buildReportsService({
    transactionRepository: { createQueryBuilder: vi.fn().mockReturnValue(qb) },
  });
  const filters = () => {
    const dateTo = calls.findIndex(([sql]) => sql === 'transaction.transactionDate <= :to');
    return calls.slice(dateTo + 1);
  };
  return { service, filters };
}

const everyFilter = {
  dateFrom: '2026-09-01',
  dateTo: '2026-09-30',
  type: 'expense',
  bankName: 'Example Bank',
  owner: 'me',
  counterparties: ' ACME Store , Example Cafe ,',
  statuses: 'parsed,error',
  keywords: '  Rent ',
  amountMin: 10,
  amountMax: 500,
  currencies: 'EUR, USD',
  billable: true,
  approved: false,
  exported: true,
  paid: false,
  has: 'errors,transactions,dateRange,currency',
};

const sharedConditions: Array<[string, unknown]> = [
  ['transaction.transactionType = :transactionType', { transactionType: TransactionType.EXPENSE }],
  ['statement.bankName = :bankName', { bankName: 'Example Bank' }],
  ['transaction.ownerMemberId = :ownerMemberId', { ownerMemberId: SELF }],
  [
    `${counterpartySql} IN (:...counterparties)`,
    { counterparties: ['ACME Store', 'Example Cafe'], privacyViewerId: SELF },
  ],
  ['statement.status IN (:...statuses)', { statuses: ['parsed', 'error'] }],
  [keywordSql, { keyword: '%rent%', privacyViewerId: SELF }],
  ['ABS(COALESCE(transaction.amount, 0)) >= :amountMin', { amountMin: 10 }],
  ['ABS(COALESCE(transaction.amount, 0)) <= :amountMax', { amountMax: 500 }],
  ['transaction.currency IN (:...currencies)', { currencies: ['EUR', 'USD'] }],
  ['ABS(COALESCE(transaction.amount, 0)) > 0', undefined],
  [
    'statement.status IN (:...notApprovedStatuses)',
    { notApprovedStatuses: ['uploaded', 'processing', 'error'] },
  ],
];

const oppositeFilter = {
  dateFrom: '2026-09-01',
  dateTo: '2026-09-30',
  type: 'income',
  owner: 'shared',
  counterparties: ' , ',
  statuses: ',',
  currencies: ' ',
  billable: false,
  approved: true,
  exported: false,
  paid: true,
};

const oppositeShared: Array<[string, unknown]> = [
  ['transaction.transactionType = :transactionType', { transactionType: TransactionType.INCOME }],
  ['transaction.ownerMemberId IS NULL', undefined],
  ['ABS(COALESCE(transaction.amount, 0)) <= 0', undefined],
  [
    'statement.status IN (:...approvedStatuses)',
    { approvedStatuses: ['validated', 'completed', 'parsed'] },
  ],
];

describe('ReportsService — top categories filters', () => {
  it('adds a condition per filter, and the statement checks `has` asks for', async () => {
    const { service, filters } = recordingService();

    await service.getTopCategoriesReport(WS_ID, everyFilter as any, SELF);

    // `exported` and `paid` are accepted but not applied here.
    expect(filters()).toEqual([
      ...sharedConditions,
      [
        '(statement.status = :errorStatus OR statement.errorMessage IS NOT NULL)',
        { errorStatus: 'error' },
      ],
      ['COALESCE(statement.totalTransactions, 0) > 0', undefined],
      [
        '(statement.statementDateFrom IS NOT NULL OR statement.statementDateTo IS NOT NULL)',
        undefined,
      ],
      ['statement.currency IS NOT NULL', undefined],
    ]);
  });

  it('applies the opposite booleans and skips empty lists', async () => {
    const { service, filters } = recordingService();

    await service.getTopCategoriesReport(WS_ID, oppositeFilter as any, SELF);

    expect(filters()).toEqual(oppositeShared);
  });
});

describe('ReportsService — spend over time filters', () => {
  it('adds a condition per filter, and the exported and paid checks', async () => {
    const { service, filters } = recordingService();

    await service.getSpendOverTimeReport(WS_ID, everyFilter as any, SELF);

    // `has` is not part of this report.
    expect(filters()).toEqual([
      ...sharedConditions,
      ['statement.processedAt IS NOT NULL', undefined],
      ['statement.statementDateTo IS NULL', undefined],
    ]);
  });

  it('applies the opposite booleans and skips empty lists', async () => {
    const { service, filters } = recordingService();

    await service.getSpendOverTimeReport(WS_ID, oppositeFilter as any, SELF);

    expect(filters()).toEqual([
      ...oppositeShared,
      ['statement.processedAt IS NULL', undefined],
      ['statement.statementDateTo IS NOT NULL', undefined],
    ]);
  });
});
