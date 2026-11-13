import type { AppImportResult } from '../../../contracts';
import type { RowResult } from '../targets/target.types';
import type { FreshTxn } from './app-import-dedupe';
import type { AppProblem, ParsedAppFile } from './app-model';
import type { PlannedAccount } from './app-plan-accounts';
import type { BudgetPlan } from './app-plan-budgets';
import type { PlannedCategory, PlannedGroup } from './app-plan-categories';

const MAX_PROBLEMS = 100;

export interface AppImportOutcome {
  files: ParsedAppFile[];
  rowsPerFile: Map<string, number>;
  accounts: Map<string, PlannedAccount>;
  categories: Map<string, PlannedCategory>;
  groups: Map<string, PlannedGroup>;
  payees: { created: number; matched: number };
  fresh: FreshTxn[];
  duplicates: number;
  transfers: number;
  budgetPlan: BudgetPlan;
  budgetStatuses: RowResult['status'][];
}

/** The answer of a dry run or a commit: one count per kind of record, and the problems. */
export function appImportResult(
  outcome: AppImportOutcome,
  batchId: string | null,
  dryRun: boolean,
): AppImportResult {
  const problems: AppProblem[] = outcome.files.flatMap(file => file.problems);
  const categories = [...new Set(outcome.categories.values())];
  const transfersCreated = new Set(outcome.fresh.map(txn => txn.pairKey).filter(Boolean)).size;
  const written = outcome.fresh.filter(txn => !txn.adoptId);
  const count = (status: RowResult['status']) =>
    outcome.budgetStatuses.filter(item => item === status).length;
  return {
    batchId,
    dryRun,
    files: outcome.files.map(file => ({
      fileName: file.fileName,
      app: file.app,
      kind: file.kind,
      rows: outcome.rowsPerFile.get(file.fileName) ?? 0,
    })),
    accounts: [...outcome.accounts.values()].map(account => ({
      name: account.name,
      status: account.status,
      walletId: account.status === 'matched' ? account.walletId : dryRun ? null : account.walletId,
      currency: account.currency,
      transactions: written.filter(txn => txn.accountKey === account.key).length,
      opening: account.opening,
      openingsSkipped: account.openingsSkipped,
    })),
    categories: {
      created: categories.filter(item => item.status === 'created').length,
      matched: categories.filter(item => item.status === 'matched').length,
      groups: [...outcome.groups.values()].filter(group => group.status === 'created').length,
      items: categories.map(item => ({ group: item.group, name: item.name, status: item.status })),
    },
    payees: outcome.payees,
    transactions: {
      created: written.length,
      skipped: outcome.duplicates,
      linked: outcome.fresh.length - written.length,
      errors: problems.length,
      transfers: transfersCreated,
      splits: new Set(outcome.fresh.map(txn => txn.splitKey).filter(Boolean)).size,
    },
    budgets: {
      month: outcome.budgetPlan.month,
      created: count('created'),
      updated: count('updated'),
      skipped: count('skipped') + outcome.budgetPlan.skipped,
    },
    problems: problems.slice(0, MAX_PROBLEMS),
  };
}

/** Whether a commit would write anything at all. */
export const writesAnything = (outcome: AppImportOutcome): boolean =>
  outcome.fresh.length > 0 ||
  outcome.budgetStatuses.some(status => status === 'created' || status === 'updated') ||
  [...outcome.accounts.values()].some(
    account => account.status === 'created' || (account.takesOpening && account.opening !== 0),
  );
