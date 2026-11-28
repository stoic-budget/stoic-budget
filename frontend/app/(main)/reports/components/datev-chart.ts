/** Each chart's bank account: 1200 in SKR 03 is receivables in SKR 04, whose bank is 1800. */
const CHART_BANK = { '03': '1200', '04': '1800' } as const;

/**
 * The form after picking another chart: a bank left at the old chart's own
 * number follows to the new chart's bank; a number typed in by hand stays.
 */
export function switchChart<T extends { chart: '03' | '04'; bank: string }>(
  form: T,
  chart: '03' | '04',
): T {
  const followsChart = form.bank === '' || form.bank === CHART_BANK[form.chart];
  return { ...form, chart, bank: followsChart ? CHART_BANK[chart] : form.bank };
}

/** The year, or one of its months: DATEV recommends a file per booking period. */
export function periodOf(year: number, month: string): { from: string; to: string } {
  if (month === 'year') {
    return { from: `${year}-01-01`, to: `${year}-12-31` };
  }
  const m = Number(month);
  const last = new Date(Date.UTC(year, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, '0');
  return { from: `${year}-${mm}-01`, to: `${year}-${mm}-${last}` };
}
