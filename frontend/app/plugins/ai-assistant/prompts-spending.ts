import type {
  DashboardCashFlowEntriesResponse,
  DashboardResponse,
  DashboardTrendsResponse as TrendsResponse,
} from '@/app/lib/contracts';
import {
  dataHealthNote,
  forecastSection,
  formatCategories,
  formatDays,
  formatNamedTotals,
  isoDay,
  missingRatesNote,
  money,
  type PromptPeriod,
  periodOf,
  todayLine,
  upcomingEvents,
} from './prompt-format';
import {
  fetchCashFlowEntries,
  fetchDashboard,
  fetchForecast,
  fetchPeriodDashboard,
  fetchTrends,
  optional,
  type PromptContext,
} from './prompt-sources';

const LARGEST_ROWS = 20;

type Entry = DashboardCashFlowEntriesResponse['entries'][number];

/**
 * With no month picked the prompt reads a rolling 30 days while the dashboard
 * shows a calendar month: gives the month's figures too, so the two can be told apart.
 */
async function dashboardMonthLine(context: PromptContext): Promise<string> {
  if (context.month) {
    return '';
  }
  const { snapshot, effectiveSince, effectiveEndDate } = await fetchDashboard('month');
  const now = new Date();
  const since = effectiveSince ?? isoDay(new Date(now.getFullYear(), now.getMonth(), 1));
  const until = effectiveEndDate ?? isoDay(now);
  return `\nThe calendar month my dashboard shows (${since} to ${until}): income ${money(snapshot.income30d, snapshot.currency)}, expenses ${money(snapshot.expense30d, snapshot.currency)}.\n`;
}

/** Every counted row of the period; the API answers by calendar month. */
async function periodEntries(period: PromptPeriod): Promise<Entry[]> {
  const months: string[] = [];
  const cursor = new Date(`${period.since.slice(0, 7)}-01T00:00:00`);
  while (isoDay(cursor).slice(0, 7) <= period.until.slice(0, 7)) {
    months.push(isoDay(cursor).slice(0, 7));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  const answers = await Promise.all(months.map(fetchCashFlowEntries));
  return answers
    .flatMap(answer => answer.entries)
    .filter(entry => entry.date >= period.since && entry.date <= period.until);
}

const entryLine = (entry: Entry, currency: string): string =>
  `- ${entry.date} ${entry.name}: ${entry.kind} ${money(entry.amount, currency)}`;

/** Rows with the same payee, amount and day: what a double charge looks like. */
function repeatedEntries(entries: readonly Entry[], currency: string): string {
  const groups = new Map<string, Entry[]>();
  for (const entry of entries) {
    const key = `${entry.date}|${entry.name}|${entry.kind}|${entry.amount}`;
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  return [...groups.values()]
    .filter(group => group.length > 1)
    .map(group => `${entryLine(group[0], currency)}, ${group.length} times`)
    .join('\n');
}

/** Trends lists only the top categories; the rest is named so the list still adds up. */
function trendCategories(trends: TrendsResponse, currency: string): string {
  const listed = trends.categories.reduce((sum, category) => sum + category.amount, 0);
  const rest = trends.sources.statements.expense - listed;
  const others = rest >= 0.01 ? `\nAll other categories: ${money(rest, currency)}` : '';
  return `${formatCategories(trends.categories, currency)}${others}`;
}

export const spendingPrompts = [
  {
    key: 'expense-summary',
    async buildPrompt(context: PromptContext) {
      const [data, monthLine] = await Promise.all([
        fetchPeriodDashboard(context),
        dashboardMonthLine(context),
      ]);
      const { snapshot, topCategories } = data;
      const period = periodOf(data, context, 30);
      return `You are a financial analyst. ${todayLine()} Here are my expenses by category for ${period.text}:

${formatCategories(topCategories, snapshot.currency)}

Currency: ${snapshot.currency}
Total expenses: ${money(snapshot.expense30d, snapshot.currency)}
Total income: ${money(snapshot.income30d, snapshot.currency)}
${monthLine}${dataHealthNote(data.dataHealth, snapshot.currency)}${missingRatesNote(snapshot.missingRates)}
Please:
1. Summarize my spending patterns
2. Identify the largest expense categories
3. Suggest areas where I could reduce spending
4. Compare category proportions and flag anything unusual`;
    },
  },
  {
    key: 'cash-flow',
    async buildPrompt(context: PromptContext) {
      const [data, forecast, monthLine] = await Promise.all([
        fetchPeriodDashboard(context),
        optional(fetchForecast),
        dashboardMonthLine(context),
      ]);
      const { snapshot, cashFlow } = data;
      const period = periodOf(data, context, 30);
      const forecastBlock = forecast
        ? `
The app's own forecast for me:
${forecastSection(forecast)}

The next known movements:
${upcomingEvents(forecast, 15) || '- none recorded'}
`
        : '';
      return `You are a financial analyst. ${todayLine()} Here is my daily cash flow for ${period.text}:

${formatDays(cashFlow, snapshot.currency)}

Currency: ${snapshot.currency}
Period totals — Income: ${money(snapshot.income30d, snapshot.currency)}, Expenses: ${money(snapshot.expense30d, snapshot.currency)}, Net: ${money(snapshot.netFlow30d, snapshot.currency)}
${monthLine}${forecastBlock}${dataHealthNote(data.dataHealth, snapshot.currency)}${missingRatesNote(snapshot.missingRates)}
Please:
1. Analyze my cash flow trend
2. Identify days with unusual spikes or drops
3. Calculate my average daily net flow
4. ${forecast ? "Check the app's forecast against this history: say what it means for me, what could make it wrong, and what to do about any shortfall or overdue bill" : 'Provide a forecast for the next 30 days based on these patterns'}`;
    },
  },
  {
    key: 'top-counterparties',
    async buildPrompt(context: PromptContext) {
      const [trends, dashboard] = await Promise.all([
        fetchTrends(context),
        fetchPeriodDashboard(context),
      ]);
      const currency = dashboard.snapshot.currency;
      const period = periodOf(dashboard, context, 30);
      // The trends list holds only who paid me; who I paid comes from the dashboard.
      const incomeSources = formatNamedTotals(trends.counterparties, currency, 10);
      const merchants = formatNamedTotals(dashboard.topMerchants, currency, 5);
      return `You are a financial analyst. ${todayLine()} Here is who I did business with over ${period.text}.

Who paid me (top income sources):
${incomeSources || '- no income in this period'}

Who I paid most (top 5 spending merchants):
${merchants || '- no spending in this period'}

Currency: ${currency}
${missingRatesNote(dashboard.snapshot.missingRates)}
Please:
1. Say how dependent I am on my largest income sources
2. Categorize the merchants I pay (vendors, services, subscriptions, etc.)
3. Flag merchants with unusually high amounts or transaction counts
4. Suggest which spending relationships could be renegotiated or cancelled`;
    },
  },
  {
    key: 'anomaly-detection',
    async buildPrompt(context: PromptContext) {
      const [dashboard, trends]: [DashboardResponse, TrendsResponse] = await Promise.all([
        fetchPeriodDashboard(context),
        fetchTrends(context),
      ]);
      const currency = dashboard.snapshot.currency;
      const period = periodOf(trends, context, 30);
      const entries = await periodEntries(period);
      const largest = [...entries]
        .sort((left, right) => right.amount - left.amount)
        .slice(0, LARGEST_ROWS)
        .map(entry => entryLine(entry, currency));
      const repeated = repeatedEntries(entries, currency);
      return `You are a financial fraud and anomaly detection specialist. ${todayLine()} Here is my transaction data for ${period.text}.

Daily totals:
${formatDays(trends.dailyTrend, currency)}

The largest transactions (${largest.length} of ${entries.length}):
${largest.join('\n') || '- no transactions in this period'}
${repeated ? `\nSame payee, amount and day:\n${repeated}\n` : ''}
Category breakdown:
${trendCategories(trends, currency)}

Currency: ${currency}
${dataHealthNote(dashboard.dataHealth, currency)}${missingRatesNote(dashboard.snapshot.missingRates)}
Please:
1. Identify any unusual transactions or patterns
2. Flag days where spending significantly deviates from the average
3. Look for suspicious patterns (duplicate charges, unusual timing, etc.)
4. Rate the overall health of my transaction patterns (1-10)`;
    },
  },
];
