import { statementsTopSpendersEmpty } from './empty-translations';
import { statementsTopSpendersFlow } from './flow-translations';
import { statementsTopSpendersGeneral2 } from './general-2-translations';
import { statementsTopSpendersGeneral } from './general-translations';
import { statementsTopSpendersSort } from './sort-translations';
import { statementsTopSpendersSource } from './source-translations';
import { statementsTopSpendersTotal } from './total-translations';
import { statementsTopSpendersView } from './view-translations';

export const statementsTopSpenders = {
  ...statementsTopSpendersFlow,
  ...statementsTopSpendersEmpty,
  ...statementsTopSpendersView,
  ...statementsTopSpendersTotal,
  ...statementsTopSpendersSource,
  ...statementsTopSpendersSort,
  ...statementsTopSpendersGeneral,
  ...statementsTopSpendersGeneral2,
};
