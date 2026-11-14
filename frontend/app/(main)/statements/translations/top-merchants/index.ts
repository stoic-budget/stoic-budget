import { statementsTopMerchantsGeneral2 } from './general-2-translations';
import { statementsTopMerchantsGeneral } from './general-translations';
import { statementsTopMerchantsSort } from './sort-translations';
import { statementsTopMerchantsSource } from './source-translations';
import { statementsTopMerchantsTotal } from './total-translations';

export const statementsTopMerchants = {
  ...statementsTopMerchantsTotal,
  ...statementsTopMerchantsSource,
  ...statementsTopMerchantsSort,
  ...statementsTopMerchantsGeneral,
  ...statementsTopMerchantsGeneral2,
};
