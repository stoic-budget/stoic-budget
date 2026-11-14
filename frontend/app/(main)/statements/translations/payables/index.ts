import { statementsPayablesActions } from './actions-translations';
import { statementsPayablesAuth } from './auth-translations';
import { statementsPayablesDrawer } from './drawer-translations';
import { statementsPayablesEmpty } from './empty-translations';
import { statementsPayablesExport } from './export-translations';
import { statementsPayablesFilters } from './filters-translations';
import { statementsPayablesGeneral } from './general-translations';
import { statementsPayablesList } from './list-translations';
import { statementsPayablesSort } from './sort-translations';
import { statementsPayablesSources } from './sources-translations';
import { statementsPayablesStatus } from './status-translations';
import { statementsPayablesSummary } from './summary-translations';
import { statementsPayablesToasts } from './toasts/index';

export const statementsPayables = {
  summary: statementsPayablesSummary,
  filters: statementsPayablesFilters,
  sort: statementsPayablesSort,
  status: statementsPayablesStatus,
  sources: statementsPayablesSources,
  list: statementsPayablesList,
  drawer: statementsPayablesDrawer,
  actions: statementsPayablesActions,
  empty: statementsPayablesEmpty,
  auth: statementsPayablesAuth,
  toasts: statementsPayablesToasts,
  ...statementsPayablesExport,
  ...statementsPayablesGeneral,
};
