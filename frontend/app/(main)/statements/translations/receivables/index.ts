import { statementsReceivablesActions } from './actions-translations';
import { statementsReceivablesAuth } from './auth-translations';
import { statementsReceivablesDrawer } from './drawer-translations';
import { statementsReceivablesEmpty } from './empty-translations';
import { statementsReceivablesGeneral } from './general-translations';
import { statementsReceivablesList } from './list-translations';
import { statementsReceivablesSort } from './sort-translations';
import { statementsReceivablesStatus } from './status-translations';
import { statementsReceivablesSummary } from './summary-translations';
import { statementsReceivablesToasts } from './toasts-translations';

export const statementsReceivables = {
  summary: statementsReceivablesSummary,
  sort: statementsReceivablesSort,
  status: statementsReceivablesStatus,
  list: statementsReceivablesList,
  drawer: statementsReceivablesDrawer,
  actions: statementsReceivablesActions,
  empty: statementsReceivablesEmpty,
  auth: statementsReceivablesAuth,
  toasts: statementsReceivablesToasts,
  ...statementsReceivablesGeneral,
};
