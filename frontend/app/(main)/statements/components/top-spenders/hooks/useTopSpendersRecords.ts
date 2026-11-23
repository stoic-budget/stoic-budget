import { useMemo } from 'react';
import {
  applyStatementsFilters,
  type StatementFilterItem,
  type StatementFilters,
} from '@/app/(main)/statements/components/filters/statement-filters';
import type { AnalyticsFromOption } from '@/app/(main)/statements/components/shared-analytics.utils';
import {
  getBankDisplayName,
  mapReceiptToRecord,
  mapStatementToRecord,
} from '@/app/(main)/statements/components/top-spenders/helpers/top-spenders-mappers';
import type {
  TopSpenderFlowType,
  TopSpenderRecord,
} from '@/app/(main)/statements/components/top-spenders/top-spenders.types';
import type { ReceiptDocument, Transaction } from '@/app/(main)/statements/types/statement-types';
import { useIntlayer } from '@/app/i18n';

type StatementWithWorkspace = StatementFilterItem & {
  workspaceId?: string;
  workspaceName?: string;
};

type Params = {
  statements: StatementWithWorkspace[];
  /** Confirmed income and spending rows: a statement counts as the sum of its own. */
  transactions: Transaction[];
  receipts: ReceiptDocument[];
  workspaceCurrency: string;
  appliedFilters: StatementFilters;
  searchInput: string;
  activeFlowType: TopSpenderFlowType;
};

export type FromOption = AnalyticsFromOption;

export type RecordsReturn = {
  allRecords: TopSpenderRecord[];
  flowFilteredRecords: TopSpenderRecord[];
  flowRecordsWithoutDateFilter: TopSpenderRecord[];
  fromOptions: FromOption[];
  currencyOptions: string[];
};

const orMatch = (s: string | null | undefined, q: string): boolean =>
  (s ?? '').toLowerCase().includes(q);

const matchesQuery = (r: TopSpenderRecord, query: string): boolean =>
  r.company.toLowerCase().includes(query) ||
  orMatch(r.sender, query) ||
  orMatch(r.subject, query) ||
  orMatch(r.bankName, query);

const filterByQuery = (records: TopSpenderRecord[], searchInput: string): TopSpenderRecord[] => {
  const query = searchInput.trim().toLowerCase();
  if (!query) {
    return records;
  }
  return records.filter(r => matchesQuery(r, query));
};

const getUserLabel = (user: TopSpenderRecord['user'], userFallback: string): string =>
  user?.name ?? user?.email ?? userFallback;

const getUserDescription = (user: TopSpenderRecord['user']): string | null => {
  const email = user?.email;
  return email ? `@${email.split('@')[0]}` : null;
};

const buildUserOption = (record: TopSpenderRecord, userFallback: string): FromOption | null => {
  const uid = record.user?.id;
  if (!uid) {
    return null;
  }
  return {
    id: `user:${uid}`,
    label: getUserLabel(record.user, userFallback),
    description: getUserDescription(record.user),
  };
};

const buildBankOption = (bank: string): FromOption => ({
  id: `bank:${bank}`,
  label: getBankDisplayName(bank),
  description: null,
  bankName: bank,
});

const buildFromOptions = (allRecords: TopSpenderRecord[], userFallback: string): FromOption[] => {
  const seen = new Map<string, FromOption>();
  allRecords.forEach(record => {
    const userOpt = buildUserOption(record, userFallback);
    if (userOpt && !seen.has(userOpt.id)) {
      seen.set(userOpt.id, userOpt);
    }
    const bank = record.bankName;
    if (bank && !seen.has(`bank:${bank}`)) {
      seen.set(`bank:${bank}`, buildBankOption(bank));
    }
  });
  return Array.from(seen.values());
};

/**
 * A statement as the rows of it that count: what was confirmed and is income
 * or spending, not the file's own totals (which hold rows still in Review,
 * transfers and duplicates). A row an approved receipt stands for is left to
 * the receipt, so a scan or an attached receipt is counted once. A statement
 * with no such row is not shown.
 */
const asCounted = (
  statements: Params['statements'],
  transactions: Transaction[],
  receipts: ReceiptDocument[],
): Params['statements'] => {
  const byReceipt = new Set(receipts.map(receipt => receipt.transactionId).filter(Boolean));
  const totals = new Map<string, { debit: number; credit: number }>();
  for (const row of transactions) {
    if (!row.statementId || byReceipt.has(row.id)) continue;
    const sum = totals.get(row.statementId) ?? { debit: 0, credit: 0 };
    sum.debit += Number(row.debit) || 0;
    sum.credit += Number(row.credit) || 0;
    totals.set(row.statementId, sum);
  }
  return statements.flatMap(statement => {
    const sum = totals.get(statement.id);
    return sum ? [{ ...statement, totalDebit: sum.debit, totalCredit: sum.credit }] : [];
  });
};

export const useTopSpendersRecords = ({
  statements,
  transactions,
  receipts,
  workspaceCurrency,
  appliedFilters,
  searchInput,
  activeFlowType,
}: Params): RecordsReturn => {
  const allRecords = useMemo<TopSpenderRecord[]>(() => {
    const mappedStatements = asCounted(statements, transactions, receipts).map(item =>
      mapStatementToRecord(item, workspaceCurrency),
    );
    const mappedReceipts = receipts.map(r => mapReceiptToRecord(r, workspaceCurrency));
    return [...mappedStatements, ...mappedReceipts];
  }, [statements, transactions, receipts, workspaceCurrency]);

  const filteredRecords = useMemo(
    () =>
      filterByQuery(
        applyStatementsFilters<TopSpenderRecord>(allRecords, appliedFilters),
        searchInput,
      ),
    [allRecords, appliedFilters, searchInput],
  );

  const flowFilteredRecords = useMemo(
    () => filteredRecords.filter(r => r.flowType === activeFlowType),
    [filteredRecords, activeFlowType],
  );

  const recordsWithoutDateFilter = useMemo(
    () =>
      filterByQuery(
        applyStatementsFilters<TopSpenderRecord>(allRecords, { ...appliedFilters, date: null }),
        searchInput,
      ),
    [allRecords, appliedFilters, searchInput],
  );

  const flowRecordsWithoutDateFilter = useMemo(
    () => recordsWithoutDateFilter.filter(r => r.flowType === activeFlowType),
    [recordsWithoutDateFilter, activeFlowType],
  );

  const userFallback = useIntlayer('statementsAnalyticsRecords').userFallback.value;
  const fromOptions = useMemo(
    () => buildFromOptions(allRecords, userFallback),
    [allRecords, userFallback],
  );

  const currencyOptions = useMemo(
    () => Array.from(new Set(allRecords.map(r => r.currencyValue).filter(Boolean))),
    [allRecords],
  );

  return {
    allRecords,
    flowFilteredRecords,
    flowRecordsWithoutDateFilter,
    fromOptions,
    currencyOptions,
  };
};
