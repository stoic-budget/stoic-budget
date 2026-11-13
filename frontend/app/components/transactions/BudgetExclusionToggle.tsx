'use client';

import { useIntlayer } from '@/app/i18n';
import { useSetExcludedFromBudgets } from './hooks/useBulkExcludeFromBudgets';
import type { Transaction } from './types';

/**
 * Leaves the row out of budgets, reports and the forecast, or brings it back.
 * The row still moves its account's balance and net worth: the money did leave.
 */
export function BudgetExclusionToggle({ transaction }: { transaction: Transaction }) {
  const t = useIntlayer('budgetExclusion');
  const { setExcluded, saving } = useSetExcludedFromBudgets();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 16 }}>
      <label className="seneca-tx-detail__check">
        <input
          type="checkbox"
          checked={transaction.excludedFromBudgets === true}
          disabled={saving}
          onChange={event => void setExcluded([transaction.id], event.target.checked)}
        />
        {t.toggle}
      </label>
      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t.hint}</span>
    </div>
  );
}
