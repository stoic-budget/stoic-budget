import { statementsSpendOverTimeAnalyticsGeneral2 } from './general-2-translations';
import { statementsSpendOverTimeAnalyticsGeneral } from './general-translations';
import { statementsSpendOverTimeAnalyticsSort } from './sort-translations';
import { statementsSpendOverTimeAnalyticsSource } from './source-translations';
import { statementsSpendOverTimeAnalyticsTotal } from './total-translations';

export const statementsSpendOverTimeAnalytics = {
  ...statementsSpendOverTimeAnalyticsTotal,
  ...statementsSpendOverTimeAnalyticsSource,
  ...statementsSpendOverTimeAnalyticsSort,
  ...statementsSpendOverTimeAnalyticsGeneral,
  ...statementsSpendOverTimeAnalyticsGeneral2,
};
