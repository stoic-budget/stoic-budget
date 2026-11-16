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
  const { state, failed, save, latest } = useViewPreference(
    'transactions',
    readTransactionsPreference,
  );
  const views = state?.savedViews ?? [];
  // Writing before the stored views are known would replace them with this one.
  const ready = state !== undefined && !failed;
  // Another tab may have saved views since this one loaded: change the stored
  // list, not this tab's copy. If it cannot be read, nothing is written.
  const write = (change: (views: SavedView[]) => SavedView[]) => {
    if (!ready) {
      return;
    }
    latest()
      .then(fresh => {
        const stored = fresh ?? { savedViews: [] };
        save({ ...stored, savedViews: change(stored.savedViews) });
      })
      .catch(() => {
        // Same as a failed save: the view is simply not kept.
      });
  };
  return {
    views,
    ready,
    failed,
    saveView: (name: string, filters: TransactionFilters) =>
      write(stored => addView(stored, name, filters)),
    renameView: (id: string, name: string) => write(stored => renameView(stored, id, name)),
    removeView: (id: string) => write(stored => removeView(stored, id)),
  };
}
