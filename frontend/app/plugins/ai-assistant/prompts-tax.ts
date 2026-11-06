import type { PayablesSummary, TaxYearReport, WorkspaceTaxSettings } from '@/app/lib/contracts';
import {
  formatCategories,
  missingRatesNote,
  money,
  periodOf,
  taxYearSection,
  todayLine,
} from './prompt-format';
import {
  fetchDashboard,
  fetchReceivables,
  fetchTaxDeadlines,
  fetchTaxSettings,
  fetchTaxYearReport,
  optional,
  type PromptContext,
} from './prompt-sources';

const VAT_STATUS: Record<WorkspaceTaxSettings['vatStatus'], string> = {
  registered: 'VAT registered',
  small_business: 'small business, no VAT charged',
  not_registered: 'not VAT registered',
};

function taxResidenceLine(settings: WorkspaceTaxSettings | null): string {
  if (!settings) {
    return '';
  }
  const place = settings.jurisdiction
    ? `${settings.jurisdiction.name} (${settings.jurisdiction.code})`
    : 'not set in the app, ask me before giving country-specific advice';
  return `\nTax residence: ${place}. Status: ${VAT_STATUS[settings.vatStatus]}.\n`;
}

/** `toPay` and `overdue` are separate piles: together they are what clients still owe. */
function receivablesLine(receivables: PayablesSummary | null, currency: string): string {
  const owed = (receivables?.toPay ?? 0) + (receivables?.overdue ?? 0);
  if (!receivables || owed <= 0) {
    return '';
  }
  return `\nInvoices still owed to me: ${money(owed, currency)}, of which overdue ${money(receivables.overdue, currency)}.\n`;
}

export const taxPrompt = {
  key: 'tax-preparation',
  async buildPrompt(context: PromptContext) {
    const now = new Date();
    const year = now.getFullYear();
    // Early in the year last year's return is the one being prepared.
    const years = now.getMonth() < 3 ? [year - 1, year] : [year];
    const [dashboard, reports, deadlines, receivables, settings] = await Promise.all([
      fetchDashboard('90d'),
      Promise.all(years.map(y => optional(() => fetchTaxYearReport(y)))),
      optional(fetchTaxDeadlines),
      optional(fetchReceivables),
      optional(fetchTaxSettings),
    ]);
    const { snapshot, topCategories } = dashboard;
    const sections = reports.filter((report): report is TaxYearReport => report !== null);
    const upcoming = (deadlines ?? []).filter(deadline => !deadline.done).slice(0, 5);
    // A tax question always reads 90 days, whatever month the dashboard has picked.
    const period = periodOf(dashboard, { ...context, month: null }, 90);

    const asks = [
      'Identify potentially tax-deductible expenses, and categories I should mark tax-relevant',
      'Summarize income vs expenses for tax reporting',
      'Flag transactions that may need special tax treatment, and rows without documents',
      ...(upcoming.length > 0 ? ['Tell me what to prepare for the upcoming returns'] : []),
      'Suggest tax-saving strategies based on my spending patterns',
    ];

    return `You are a tax preparation assistant. ${todayLine()} Here is my financial picture.
${taxResidenceLine(settings)}
Over ${period.text} — income ${money(snapshot.income30d, snapshot.currency)}, expenses ${money(snapshot.expense30d, snapshot.currency)}, net ${money(snapshot.netFlow30d, snapshot.currency)}.
Spending by category:
${formatCategories(topCategories, snapshot.currency)}
${missingRatesNote(snapshot.missingRates)}
${sections.map(taxYearSection).join('\n')}${
  upcoming.length > 0
    ? `
Upcoming returns:
${upcoming.map(deadline => `- ${deadline.returnName} for ${deadline.periodStart} to ${deadline.periodEnd}: due ${deadline.dueDate} (${deadline.daysLeft} days left)`).join('\n')}
`
    : ''
}${receivablesLine(receivables, snapshot.currency)}
Please:
${asks.map((ask, i) => `${i + 1}. ${ask}`).join('\n')}

Note: This is for informational purposes only. Always consult a qualified tax professional.`;
  },
};
