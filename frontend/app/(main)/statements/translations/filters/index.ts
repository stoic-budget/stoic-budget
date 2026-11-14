import { statementsFiltersColumn } from './column-translations';
import { statementsFiltersDate } from './date-translations';
import { statementsFiltersDrawer } from './drawer-translations';
import { statementsFiltersGeneral } from './general-translations';
import { statementsFiltersGroup } from './group-translations';
import { statementsFiltersHas } from './has-translations';
import { statementsFiltersStatus } from './status-translations';
import { statementsFiltersType } from './type-translations';

export const statementsFilters = {
  ...statementsFiltersType,
  ...statementsFiltersStatus,
  ...statementsFiltersDate,
  ...statementsFiltersDrawer,
  ...statementsFiltersGroup,
  ...statementsFiltersHas,
  ...statementsFiltersColumn,
  ...statementsFiltersGeneral,
};
