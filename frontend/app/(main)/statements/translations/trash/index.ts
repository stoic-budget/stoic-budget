import { statementsTrashConfirm } from './confirm-translations';
import { statementsTrashDelete } from './delete-translations';
import { statementsTrashEmpty } from './empty-translations';
import { statementsTrashEntityTypes } from './entity-types-translations';
import { statementsTrashGeneral } from './general-translations';
import { statementsTrashListHeader } from './list-header-translations';
import { statementsTrashRestore } from './restore-translations';

export const statementsTrash = {
  empty: statementsTrashEmpty,
  listHeader: statementsTrashListHeader,
  entityTypes: statementsTrashEntityTypes,
  ...statementsTrashRestore,
  ...statementsTrashDelete,
  ...statementsTrashConfirm,
  ...statementsTrashGeneral,
};
