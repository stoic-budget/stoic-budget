import type { Repository } from 'typeorm';
import type { Budget } from '../../entities/budget.entity';

/**
 * Marks a budget's 80% or 100% alert sent, only if it was not: true when this
 * call is the one that marked it, so only that caller notifies. Two checks at
 * once (two approvals in Review) send one alert. Being over also counts as
 * past 80%, so an exceeded budget is never warned about 80% afterwards.
 */
export async function claimBudgetAlert(
  budgets: Repository<Budget>,
  budgetId: string,
  level: 80 | 100,
): Promise<boolean> {
  const result =
    level === 100
      ? await budgets.update(
          { id: budgetId, alertAt100Sent: false },
          { alertAt100Sent: true, alertAt80Sent: true },
        )
      : await budgets.update({ id: budgetId, alertAt80Sent: false }, { alertAt80Sent: true });
  return (result.affected ?? 0) > 0;
}
