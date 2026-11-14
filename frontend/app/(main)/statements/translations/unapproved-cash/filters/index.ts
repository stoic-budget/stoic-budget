import { statementsUnapprovedCashFiltersAmount } from './amount-translations';
import { statementsUnapprovedCashFiltersDate } from './date-translations';
import { statementsUnapprovedCashFiltersGeneral } from './general-translations';

export const statementsUnapprovedCashFilters = {
  ...statementsUnapprovedCashFiltersDate,
  ...statementsUnapprovedCashFiltersAmount,
  ...statementsUnapprovedCashFiltersGeneral,
};
