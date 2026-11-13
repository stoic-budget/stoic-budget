import { useViewPreference } from '@/app/components/transactions/hooks/useViewPreference';
import {
  addView,
  readTransactionsPreference,
  removeView,
  renameView,
  type SavedView,
} from './saved-views';
import type { TransactionFilters } from './transaction-filters';

/**
 * The person's named filter sets for the All transactions page, kept in the
 * `transactions` view preference beside whatever else that scope stores.
 */
export function useSavedViews() {
  const { state, failed, save } = useViewPreference('transactions', readTransactionsPreference);
  const views = state?.savedViews ?? [];
  // Writing before the stored views are known would replace them with this one.
  const ready = state !== undefined && !failed;
  const write = (next: SavedView[]) => {
    if (ready) {
      save({ ...(state ?? {}), savedViews: next });
    }
  };
  return {
    views,
    ready,
    failed,
    saveView: (name: string, filters: TransactionFilters) => write(addView(views, name, filters)),
    renameView: (id: string, name: string) => write(renameView(views, id, name)),
    removeView: (id: string) => write(removeView(views, id)),
  };
}
