import { statementsTopCategoriesAnalyticsGeneral2 } from './general-2-translations';
import { statementsTopCategoriesAnalyticsGeneral } from './general-translations';
import { statementsTopCategoriesAnalyticsSort } from './sort-translations';
import { statementsTopCategoriesAnalyticsSource } from './source-translations';
import { statementsTopCategoriesAnalyticsTotal } from './total-translations';

export const statementsTopCategoriesAnalytics = {
  ...statementsTopCategoriesAnalyticsTotal,
  ...statementsTopCategoriesAnalyticsSource,
  ...statementsTopCategoriesAnalyticsSort,
  ...statementsTopCategoriesAnalyticsGeneral,
  ...statementsTopCategoriesAnalyticsGeneral2,
};
