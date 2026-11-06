import type {
  BudgetList,
  ForecastResponse,
  GoalDetail,
  GoalList,
  NetWorthResponse,
  SubscriptionList,
  SubscriptionMonthStatus,
  SubscriptionSummary,
} from '@/app/lib/contracts';
import {
  balanceLine,
  dataHealthNote,
  forecastSection,
  formatCategories,
  isoDay,
  missingRatesNote,
  money,
  periodOf,
  todayLine,
} from './prompt-format';
import {
  fetchBudgets,
  fetchForecast,
  fetchGoalDetail,
  fetchGoals,
  fetchNetWorth,
  fetchPeriodDashboard,
  fetchSubscriptionDuplicates,
  fetchSubscriptionMonth,
  fetchSubscriptionSummary,
  fetchSubscriptions,
  optional,
  type PromptContext,
} from './prompt-sources';

const PACE_DAYS = 90;
const MAX_GOALS_WITH_PACE = 10;

function budgetLine(budget: BudgetList[number]): string {
  const { currency } = budget;
  const left = budget.availableAmount - budget.spentAmount;
  const parts = [
    `limit ${money(budget.limitAmount, currency)}`,
    ...(budget.carriedAmount !== 0
      ? [
          `${budget.carriedAmount > 0 ? 'carried in' : 'overspend carried in'} ${money(Math.abs(budget.carriedAmount), currency)}`,
        ]
      : []),
    `spent ${money(budget.spentAmount, currency)} (${Math.round(budget.percentUsed)}%)`,
    left >= 0 ? `left ${money(left, currency)}` : `over by ${money(-left, currency)}`,
    ...(budget.subscriptionReserve.amount > 0
      ? [
          `subscriptions still to charge this period ${money(budget.subscriptionReserve.amount, currency)}`,
        ]
      : []),
    ...budget.unconvertedSpending.map(
      item => `also ${money(item.amount, item.currency)} with no exchange rate, not counted`,
    ),
    ...budget.beforeStartSpending.map(
      item => `${money(item.amount, item.currency)} before the budget started, not counted`,
    ),
  ];
  return `- ${budget.name} (${budget.category?.name ?? 'no category'}, ${budget.periodType}, period from ${budget.currentPeriodStart}): ${parts.join(', ')}`;
}

async function budgetsPrompt(context: PromptContext) {
  const [dashboard, budgets, forecast] = await Promise.all([
    fetchPeriodDashboard(context),
    optional(fetchBudgets),
    optional(fetchForecast),
  ]);
  const { snapshot, topCategories } = dashboard;
  const current = (budgets ?? [])
    .filter(budget => budget.isActive)
    .map(budgetLine)
    .join('\n');
  const period = periodOf(dashboard, context, 30);
  const header = `You are a personal finance advisor. ${todayLine()} Here is my financial snapshot for ${period.text}:

Income: ${money(snapshot.income30d, snapshot.currency)}
Expenses: ${money(snapshot.expense30d, snapshot.currency)}
Net flow: ${money(snapshot.netFlow30d, snapshot.currency)}
${balanceLine(forecast)}
Expense breakdown by category:
${formatCategories(topCategories, snapshot.currency)}
${dataHealthNote(dashboard.dataHealth, snapshot.currency)}${missingRatesNote(snapshot.missingRates)}`;

  if (current) {
    return `${header}
My budgets now, in their current periods:
${current}

Please:
1. Say which budgets I am on track with and which I will overrun
2. Point out spending categories that have no budget but should
3. Suggest new limits where a budget is clearly too tight or too loose
4. Provide a prioritized action plan to improve my financial health`;
  }
  return `${header}
Please:
1. Create a recommended monthly budget based on my spending patterns
2. Apply the 50/30/20 rule (needs/wants/savings) to my data
3. Identify categories where I'm overspending
4. Suggest specific savings targets for each category
5. Provide a prioritized action plan to improve my financial health`;
}

/** What was put aside lately: "at my current pace" means nothing without it. */
function paceText(detail: GoalDetail | null | undefined): string {
  if (!detail) {
    return '';
  }
  const start = new Date();
  start.setDate(start.getDate() - PACE_DAYS);
  const since = isoDay(start);
  const saved = detail.contributions
    .filter(contribution => contribution.contributionDate.slice(0, 10) >= since)
    .reduce((sum, contribution) => sum + contribution.amount, 0);
  return `, put aside ${money(saved, detail.currency)} in the last ${PACE_DAYS} days`;
}

function goalLine(
  goal: GoalList[number],
  detail: GoalDetail | null | undefined,
  forecast: ForecastResponse | null,
): string {
  const planned = forecast?.events.find(
    event => event.kind === 'goal' && event.sourceId === goal.id,
  );
  return `- ${goal.name}: ${money(goal.currentAmount, goal.currency)} of ${money(goal.targetAmount, goal.currency)} (${Math.round(goal.percent)}%)${goal.targetDate ? `, target date ${goal.targetDate}` : ''}${goal.isReached ? ', reached' : ''}${paceText(detail)}${planned && forecast ? `, needs ${money(Math.abs(planned.amount), forecast.currency)} a month to make the date` : ''}`;
}

/** With no account and no asset the figure is an empty ledger, not a net worth of zero. */
function netWorthLine(netWorth: NetWorthResponse | null): string {
  if (!netWorth || (netWorth.assetsTotal === 0 && netWorth.liabilitiesTotal === 0)) {
    return '';
  }
  return `\nNet worth ${money(netWorth.current, netWorth.currency)} (assets ${money(netWorth.assetsTotal, netWorth.currency)}, liabilities ${money(netWorth.liabilitiesTotal, netWorth.currency)}), ${netWorth.change >= 0 ? 'up' : 'down'} ${money(Math.abs(netWorth.change), netWorth.currency)} over 90 days${missingRatesNote(netWorth.missingRates)}\n`;
}

async function goalsPrompt() {
  const [goals, forecast, netWorth] = await Promise.all([
    optional(fetchGoals),
    optional(fetchForecast),
    optional(fetchNetWorth),
  ]);
  const open = (goals ?? []).filter(goal => !goal.isReached).slice(0, MAX_GOALS_WITH_PACE);
  const details = await Promise.all(open.map(goal => optional(() => fetchGoalDetail(goal.id))));
  const detailOf = new Map(open.map((goal, i) => [goal.id, details[i]]));
  const goalLines = (goals ?? [])
    .map(goal => goalLine(goal, detailOf.get(goal.id), forecast))
    .join('\n');
  const noGoals = goals ? '- no goals yet' : '- I cannot share my goals here';
  const setsAside = forecast?.events.some(event => event.kind === 'goal')
    ? '\nThe forecast already sets aside the monthly amounts for goals with a target date.'
    : '';

  return `You are a personal finance coach. ${todayLine()} Here are my savings goals and where my money is heading.

Goals:
${goalLines || noGoals}

Cash forecast:
${forecast ? `${forecastSection(forecast)}${setsAside}` : '- no forecast available'}
${netWorthLine(netWorth)}
Please:
1. Tell me which goals are realistic at my current pace and which are not
2. Suggest a monthly amount for each goal that my cash flow can carry
3. Warn me if the forecast puts any goal or my safety cushion at risk
4. Suggest the order in which to fund the goals`;
}

/** `detectionMeta` is free-form JSON; only the price change is read from it. */
function priceRise(subscription: SubscriptionList[number]): string {
  const change = subscription.detectionMeta?.priceChange;
  if (
    typeof change === 'object' &&
    change !== null &&
    'previous' in change &&
    'current' in change
  ) {
    const { previous, current } = change;
    if (typeof previous === 'number' && typeof current === 'number') {
      return `, price changed from ${money(previous, subscription.currency)} to ${money(current, subscription.currency)}`;
    }
  }
  return subscription.riskStatus === 'price_changed' ? ', price changed' : '';
}

const RISK_NOTES: Partial<Record<SubscriptionList[number]['riskStatus'], string>> = {
  date_shifted: ', charge date shifted',
  missing_charge: ', expected charge is missing',
};

function subscriptionLine(subscription: SubscriptionList[number]): string {
  const { currency } = subscription;
  const usage = subscription.usageSince
    ? `, uses since ${subscription.usageSince.slice(0, 10)}: ${subscription.usageCount}${subscription.lastUsedAt ? `, last on ${subscription.lastUsedAt.slice(0, 10)}` : ''}${subscription.costPerUse !== null ? `, ${money(subscription.costPerUse, currency)} per use` : ''}`
    : '';
  return `- ${subscription.vendorName}: ${money(subscription.amount, currency)} ${subscription.frequency}${subscription.category ? ` (${subscription.category.name})` : ''}${subscription.nextChargeDate ? `, next charge ${subscription.nextChargeDate}` : ''}${usage}${priceRise(subscription)}${RISK_NOTES[subscription.riskStatus] ?? ''}`;
}

function subscriptionTotals(
  summary: SubscriptionSummary | null,
  month: SubscriptionMonthStatus | null,
): string {
  if (!summary) {
    return '';
  }
  // The summary is in the workspace currency and does not name it; the month status does.
  const inWorkspace = (amount: number) =>
    month?.currency ? money(amount, month.currency) : `${amount} in my workspace currency`;
  return `\nActive subscriptions: ${summary.activeCount}, about ${inWorkspace(summary.totalMonthlyCost)} a month.
Due in the next 30 days: ${summary.upcoming30DaysCount} charges, ${inWorkspace(summary.upcoming30DaysAmount)}.
Price changes noticed: ${summary.priceChangeCount}, worth ${inWorkspace(summary.priceChangeYearlyEffect)} over this year.\n`;
}

async function subscriptionsPrompt() {
  const [subscriptions, summary, month, duplicates] = await Promise.all([
    optional(fetchSubscriptions),
    optional(fetchSubscriptionSummary),
    optional(fetchSubscriptionMonth),
    optional(fetchSubscriptionDuplicates),
  ]);
  const of = (status: 'active' | 'detected') =>
    (subscriptions ?? [])
      .filter(subscription => subscription.status === status)
      .map(subscriptionLine)
      .join('\n');
  const detected = of('detected');
  const twins = (duplicates ?? [])
    .map(group => `- ${group.items.map(item => item.vendorName).join(', ')}`)
    .join('\n');
  const noActive = subscriptions
    ? '- no active subscriptions found'
    : '- I cannot share the list here';

  return `You are a personal finance advisor. ${todayLine()} Here are my recurring subscriptions.

${of('active') || noActive}
${detected ? `\nFound in my transactions, not confirmed by me yet:\n${detected}\n` : ''}${twins ? `\nLook like the same service paid twice:\n${twins}\n` : ''}${subscriptionTotals(summary, month)}
Please:
1. Group them (essentials, work tools, entertainment, other)
2. Point out overlaps and services I may no longer need, using how often I use them where it is shown
3. Suggest cheaper plans or yearly billing where it would save money
4. Say which of the unconfirmed ones really look like subscriptions
5. Estimate what I could save per year by acting on your suggestions`;
}

export const planningPrompts = [
  { key: 'budget-recommendations', buildPrompt: budgetsPrompt },
  { key: 'goals-runway', buildPrompt: goalsPrompt },
  { key: 'subscriptions-review', buildPrompt: subscriptionsPrompt },
];
