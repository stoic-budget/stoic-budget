import type {
  DashboardDataHealth,
  DashboardTopCategory,
  ForecastResponse,
  TaxYearReport,
} from '@/app/lib/contracts';
import type { PromptContext } from './prompt-sources';

/** One notation for every reader: the browser's locale would make `1.234` ambiguous. */
const numberFormat = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
});

export const number = (amount: number | string): string => numberFormat.format(Number(amount));

export const money = (amount: number | string, currency: string): string =>
  `${number(amount)} ${currency}`;

export const isoDay = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const todayLine = (): string => `Today is ${isoDay(new Date())}.`;

export function replyLine(locale: string): string {
  const language = new Intl.DisplayNames(['en'], { type: 'language' }).of(locale) ?? locale;
  return `Please reply in ${language}.`;
}

export interface PromptPeriod {
  since: string;
  until: string;
  /** Reads after "for" or "over": what the prompt says the figures cover. */
  text: string;
}

/** The dates the figures really cover: the picked month, the rolling days, or the shifted window. */
export function periodOf(
  answer: { effectiveSince?: string; effectiveEndDate?: string },
  context: PromptContext,
  days: number,
): PromptPeriod {
  if (context.month) {
    const [year, month] = context.month.split('-').map(Number);
    const since = `${context.month}-01`;
    const until = isoDay(new Date(year, month, 0));
    return { since, until, text: `the month ${since} to ${until}` };
  }
  if (answer.effectiveSince && answer.effectiveEndDate) {
    const { effectiveSince: since, effectiveEndDate: until } = answer;
    return {
      since,
      until,
      text: `the ${days} days from ${since} to ${until}, the latest period with data (nothing newer is recorded)`,
    };
  }
  const start = new Date();
  start.setDate(start.getDate() - days);
  const since = isoDay(start);
  const until = isoDay(new Date());
  return { since, until, text: `the last ${days} days (${since} to ${until})` };
}

/** The figures leave out or count at face value amounts in currencies with no rate. */
export function missingRatesNote(currencies: readonly string[]): string {
  return currencies.length > 0
    ? `\nNote: amounts in ${currencies.join(', ')} have no exchange rate and are counted at face value.\n`
    : '';
}

/** What the figures do not cover yet, so a low total is not read as low spending. */
export function dataHealthNote(health: DashboardDataHealth, currency: string): string {
  const notes = [
    health.statementsPendingReview > 0 &&
      `rows waiting for my confirmation, not counted: ${health.statementsPendingReview} (net ${money(health.unapprovedCash, currency)})`,
    health.receiptsPendingReview > 0 &&
      `receipts waiting for my review: ${health.receiptsPendingReview}`,
    health.uncategorizedTransactions > 0 &&
      `transactions with no category yet: ${health.uncategorizedTransactions}`,
  ].filter(note => note !== false);
  return notes.length > 0 ? `\nData still open: ${notes.join('; ')}.\n` : '';
}

export function formatCategories(
  categories: ReadonlyArray<Pick<DashboardTopCategory, 'name' | 'amount' | 'count' | 'isOther'>>,
  currency: string,
): string {
  return categories
    .slice(0, 10)
    .map(
      (c, i) =>
        // `name` is null both for uncategorized spend and for the rollup past the top categories.
        `${i + 1}. ${c.isOther ? 'All other categories' : (c.name ?? 'Uncategorized')}: ${money(c.amount, currency)} (${c.count} transactions)`,
    )
    .join('\n');
}

export function formatNamedTotals(
  rows: ReadonlyArray<{ name: string; amount: number; count: number }>,
  currency: string,
  limit: number,
): string {
  return rows
    .slice(0, limit)
    .map(
      (row, i) =>
        `${i + 1}. ${row.name}: ${money(row.amount, currency)} (${row.count} transactions)`,
    )
    .join('\n');
}

/** Every day with money moving; the rest are said to be empty instead of taking a line each. */
export function formatDays(
  days: ReadonlyArray<{ date: string; income: number; expense: number }>,
  currency: string,
): string {
  const active = days.filter(day => day.income !== 0 || day.expense !== 0);
  if (active.length === 0) {
    return '- no income or spending in this period';
  }
  const lines = active.map(
    day =>
      `${day.date}: income ${money(day.income, currency)}, expense ${money(day.expense, currency)}`,
  );
  return `${lines.join('\n')}\n(Days not listed had no income or spending.)`;
}

const FORECAST_CAVEATS: Record<
  ForecastResponse['caveats'][number],
  (f: ForecastResponse) => string
> = {
  shortHistory: f =>
    `Caveat: full months of history: ${f.monthsObserved}, fewer than the averages want.`,
  noEverydaySpending: () =>
    'Caveat: no everyday spending is left beyond subscriptions, so the projection may be too rosy.',
  derivedBalance: () =>
    'Caveat: the opening balance is summed from transactions, because no account holds a real balance.',
};

/** The workspace's own projection, with the reasons it may be off. */
export function forecastSection(forecast: ForecastResponse): string {
  const { currency } = forecast;
  const taxHeld = forecast.taxReserve
    ? ` (after holding ${money(forecast.taxReserve, currency)} for tax)`
    : '';
  return [
    `Safe to spend until ${forecast.safeToSpend.untilDate}: ${money(forecast.safeToSpend.amount, currency)}${taxHeld}`,
    `Typical month: income ${money(forecast.monthlyIncome, currency)}, expenses ${money(forecast.monthlyExpense, currency)}`,
    `Runway: ${forecast.runwayMonths === null ? 'n/a (not burning savings)' : `${forecast.runwayMonths.toFixed(1)} months`}`,
    `Projected balance: ${money(forecast.openingBalance, currency)} today, ${money(forecast.closingBalance, currency)} at the end of the forecast, lowest ${money(forecast.lowestBalance, currency)} on ${forecast.lowestBalanceDate}`,
    ...(forecast.shortfallDate ? [`The balance runs short on ${forecast.shortfallDate}`] : []),
    ...(forecast.unscheduledCommitted > 0
      ? [
          `Bills with no due date, not in the projection: ${money(forecast.unscheduledCommitted, currency)}`,
        ]
      : []),
    ...forecast.caveats.map(caveat => FORECAST_CAVEATS[caveat](forecast)),
  ].join('\n');
}

const EVENT_KINDS: Record<ForecastResponse['events'][number]['kind'], string> = {
  payable: 'bill',
  subscription: 'subscription',
  invoice: 'invoice',
  goal: 'saving for a goal',
  income: 'expected income',
  scenario: 'scenario',
  pending: 'pending at the bank, already counted',
};

/** The next known movements, nearest first, overdue bills marked. */
export function upcomingEvents(forecast: ForecastResponse, limit: number): string {
  return [...forecast.events]
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(0, limit)
    .map(
      event =>
        `- ${event.date}: ${event.label}, ${event.amount > 0 ? '+' : ''}${money(event.amount, forecast.currency)} (${EVENT_KINDS[event.kind]}${event.isOverdue ? ', overdue' : ''})`,
    )
    .join('\n');
}

/** What is really on the accounts; the dashboard's `totalBalance` only sums the rows. */
export function balanceLine(forecast: ForecastResponse | null): string {
  if (!forecast) {
    return '';
  }
  const label = forecast.caveats.includes('derivedBalance')
    ? 'Balance (summed from transactions, no account holds a real balance)'
    : 'Spendable balance on my accounts';
  return `${label}: ${money(forecast.openingBalance, forecast.currency)}\n`;
}

export function taxYearSection(report: TaxYearReport): string {
  const categories = report.categories
    .slice(0, 15)
    .map(
      category =>
        `- ${category.name} (${category.type}): ${money(category.total, report.currency)}, ${category.count} rows, ${category.documentCount} with documents`,
    )
    .join('\n');
  const size = (row: TaxYearReport['rows'][number]) => Math.abs(row.converted ?? row.amount);
  const rows = [...report.rows]
    .sort((left, right) => size(right) - size(left))
    .slice(0, 20)
    .map(
      row =>
        `- ${row.date} ${row.counterparty}: ${row.type} ${money(row.amount, row.currency)} (${row.categoryName ?? 'no category'})${row.documentCount === 0 ? ', no document' : ''}`,
    )
    .join('\n');
  return `Tax year ${report.year} — tax-relevant income ${money(report.total.income, report.currency)}, tax-relevant expenses ${money(report.total.expense, report.currency)}:
${categories || '- nothing marked tax-relevant yet'}
${rows ? `Largest tax-relevant rows of ${report.rows.length}:\n${rows}\n` : ''}${missingRatesNote(report.missingRateCurrencies)}`;
}
