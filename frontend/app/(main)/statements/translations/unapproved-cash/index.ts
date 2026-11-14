import { statementsUnapprovedCashActions } from './actions-translations';
import { statementsUnapprovedCashEmpty } from './empty-translations';
import { statementsUnapprovedCashFilters } from './filters/index';
import { statementsUnapprovedCashGeneral } from './general-translations';
import { statementsUnapprovedCashReasons } from './reasons-translations';
import { statementsUnapprovedCashSources } from './sources-translations';
import { statementsUnapprovedCashSummary } from './summary-translations';
import { statementsUnapprovedCashTable } from './table-translations';
import { statementsUnapprovedCashToasts } from './toasts-translations';

export const statementsUnapprovedCash = {
  filters: statementsUnapprovedCashFilters,
  reasons: statementsUnapprovedCashReasons,
  sources: statementsUnapprovedCashSources,
  summary: statementsUnapprovedCashSummary,
  table: statementsUnapprovedCashTable,
  actions: statementsUnapprovedCashActions,
  empty: statementsUnapprovedCashEmpty,
  toasts: statementsUnapprovedCashToasts,
  ...statementsUnapprovedCashGeneral,
};
