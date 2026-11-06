import { getApiErrorStatus } from '@/app/lib/api-error';
import type {
  BudgetList,
  DashboardCashFlowEntriesResponse,
  DashboardResponse,
  ForecastResponse,
  GoalDetail,
  GoalList,
  NetWorthResponse,
  PayablesSummary,
  SubscriptionDuplicateGroups,
  SubscriptionList,
  SubscriptionMonthStatus,
  SubscriptionSummary,
  TaxDeadlineList,
  TaxYearReport,
  DashboardTrendsResponse as TrendsResponse,
  WorkspaceTaxSettings,
} from '@/app/lib/contracts';
import { payablesApi } from '@/app/lib/payables-api';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';

/** What a prompt needs to know about where it was asked from. */
export interface PromptContext {
  /** `YYYY-MM` picked on the dashboard; null reads the last 30 days. */
  month: string | null;
  /** The UI locale, which the answer should come back in. */
  locale: string;
}

export function fetchDashboard(
  range: 'month' | '30d' | '90d',
  date?: string,
): Promise<DashboardResponse> {
  return apiQueryDecoded({
    url: '/dashboard',
    params: date ? { range, date } : { range },
    contract: 'DashboardResponse',
  });
}

/** The dashboard of the picked month, or of the last 30 days. */
export const fetchPeriodDashboard = (context: PromptContext): Promise<DashboardResponse> =>
  context.month ? fetchDashboard('month', `${context.month}-01`) : fetchDashboard('30d');

export const fetchTrends = (context: PromptContext): Promise<TrendsResponse> =>
  apiQueryDecoded({
    url: '/dashboard/trends',
    params: context.month ? { month: context.month } : { days: 30 },
    contract: 'DashboardTrendsResponse',
  });

export const fetchCashFlowEntries = (month: string): Promise<DashboardCashFlowEntriesResponse> =>
  apiQueryDecoded({
    url: '/dashboard/cash-flow/entries',
    params: { month },
    contract: 'DashboardCashFlowEntriesResponse',
  });

export const fetchBudgets = (): Promise<BudgetList> =>
  apiQueryDecoded({ url: '/budgets', contract: 'BudgetList' });

export const fetchGoals = (): Promise<GoalList> =>
  apiQueryDecoded({ url: '/goals', contract: 'GoalList' });

export const fetchGoalDetail = (id: string): Promise<GoalDetail> =>
  apiQueryDecoded({ url: `/goals/${id}`, contract: 'GoalDetail' });

export const fetchForecast = (): Promise<ForecastResponse> =>
  apiQueryDecoded({ url: '/forecast', contract: 'ForecastResponse' });

export const fetchNetWorth = (): Promise<NetWorthResponse> =>
  apiQueryDecoded({
    url: '/reports/net-worth',
    params: { range: '90d' },
    contract: 'NetWorthResponse',
  });

export const fetchSubscriptions = (): Promise<SubscriptionList> =>
  apiQueryDecoded({ url: '/subscriptions', contract: 'SubscriptionList' });

export const fetchSubscriptionSummary = (): Promise<SubscriptionSummary> =>
  apiQueryDecoded({
    url: '/subscriptions/summary',
    contract: 'SubscriptionSummary',
  });

export const fetchSubscriptionMonth = (): Promise<SubscriptionMonthStatus> =>
  apiQueryDecoded({
    url: '/subscriptions/month-status',
    contract: 'SubscriptionMonthStatus',
  });

export const fetchSubscriptionDuplicates = (): Promise<SubscriptionDuplicateGroups> =>
  apiQueryDecoded({
    url: '/subscriptions/duplicates',
    contract: 'SubscriptionDuplicateGroups',
  });

export const fetchTaxYearReport = (year: number): Promise<TaxYearReport> =>
  apiQueryDecoded({
    url: '/tax/year-report',
    params: { year },
    contract: 'TaxYearReport',
  });

export const fetchTaxDeadlines = (): Promise<TaxDeadlineList> =>
  apiQueryDecoded({ url: '/tax/deadlines', contract: 'TaxDeadlineList' });

export const fetchTaxSettings = (): Promise<WorkspaceTaxSettings> =>
  apiQueryDecoded({ url: '/tax/settings', contract: 'WorkspaceTaxSettings' });

export const fetchReceivables = (): Promise<PayablesSummary> =>
  payablesApi.getSummary('receivable');

/**
 * A source the prompt can do without: a module this workspace or user has no
 * access to leaves its section out. Any other failure stops the prompt, so a
 * server error never reaches ChatGPT dressed up as "you have no goals".
 */
export async function optional<T>(load: () => Promise<T>): Promise<T | null> {
  try {
    return await load();
  } catch (error) {
    const status = getApiErrorStatus(error);
    if (status === 403 || status === 404) {
      return null;
    }
    throw error;
  }
}
