/** Currency signs only one currency writes ("$" is many dollars'). */
export const CURRENCY_SIGNS: [string, string][] = [
  ['€', 'EUR'],
  ['£', 'GBP'],
  ['₸', 'KZT'],
  ['₽', 'RUB'],
  ['₪', 'ILS'],
  ['₹', 'INR'],
  ['฿', 'THB'],
  ['¥', 'JPY'],
];

/**
 * The currency a table's money column names in its heading: "(GBP) Amount",
 * "Balance (EUR)", "Amount in USD". It is the statement's own currency, whatever
 * other codes the rows' notes print ("Amount: EUR -109.40. Conversion rate").
 */
const HEADING_CURRENCY =
  /\(([A-Z]{3})\)\s*(?:Amount|Balance)\b|\b(?:Amount|Balance)\s*(?:\(([A-Z]{3})\)|in ([A-Z]{3})\b)/;

const SIGNS = CURRENCY_SIGNS.map(([sign]) => sign).join('');
/** "+400,00€", "-£12.50", "€ 1.000,00": a figure with its sign glued on, before or after. */
const SIGNED_FIGURE = new RegExp(`(?<=\\d)([${SIGNS}])|([${SIGNS}])\\s?(?=\\d)`, 'g');
/** Fewer signed figures than this say nothing: a fee note, a converted amount. */
const MIN_SIGNED_FIGURES = 3;

/**
 * The statement's currency as its money says it: the currency a money
 * column's heading names, else the sign glued to most of its figures (three
 * or more), over the codes the rows' notes print ("Original amount 99.00
 * HKD" under every "-11,64€"). Null when the money says nothing.
 */
export function printedCurrency(text: string): string | null {
  const heading = HEADING_CURRENCY.exec(text);
  if (heading) {
    return heading[1] ?? heading[2] ?? heading[3];
  }
  const counts = new Map<string, number>();
  for (const match of text.matchAll(SIGNED_FIGURE)) {
    const sign = match[1] ?? match[2];
    counts.set(sign, (counts.get(sign) ?? 0) + 1);
  }
  const [top, second] = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (!top || top[1] < MIN_SIGNED_FIGURES || (second && second[1] * 2 > top[1])) {
    return null;
  }
  return CURRENCY_SIGNS.find(([sign]) => sign === top[0])?.[1] ?? null;
}
