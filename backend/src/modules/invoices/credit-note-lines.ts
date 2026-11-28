import type { EntityManager } from 'typeorm';
import { fromMinor } from '../../common/utils/money.util';
import type { CreditNoteLineItem } from '../../entities/credit-note-line-item.entity';
import type { Invoice } from '../../entities/invoice.entity';
import type { InvoiceLineItem } from '../../entities/invoice-line-item.entity';
import { priceLines, totalsOf } from './invoice-pricing';

/** One invoice's share of a credit note, resolved against what it can carry. */
export interface ResolvedApplication {
  invoice: Invoice;
  lines: InvoiceLineItem[];
  /** How much of the invoice is credited, as a share of its total. */
  factor: number;
  /** What the note takes off this invoice: what was asked, never more than is left on it. */
  target: number;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * The note's lines for one invoice. A whole credit copies them as they are. A
 * partial one scales each line's amount, not its unit price, into one unit:
 * 1000 × 0.50 scaled to a quarter would round the price 0.125 to 0.13 and
 * credit 130 of the 125 asked, and 5000 × 0.02 would round to nothing (#617).
 */
export function creditedLines(
  application: ResolvedApplication,
  prefix: string,
): Array<Partial<CreditNoteLineItem>> {
  const whole = application.factor === 1;
  const scaled = scaledCents(
    application.lines.map(
      line => Number(line.quantity) * Number(line.unitPrice) * application.factor,
    ),
  );
  return application.lines.flatMap((line, index) => {
    const unitPrice = whole ? Number(line.unitPrice) : scaled[index] / 100;
    if (unitPrice === 0) {
      return [];
    }
    return [
      {
        // Named after the invoice it comes off, so a note covering three
        // invoices reads line by line.
        description: `${prefix}${line.description}`,
        quantity: whole ? Number(line.quantity) : 1,
        unitPrice,
        taxRateId: line.taxRateId,
        categoryId: line.categoryId,
        unitCode: whole ? (line.unitCode ?? 'C62') : 'C62',
        adjustmentPercent: line.adjustmentPercent ?? null,
      },
    ];
  });
}

/**
 * Amounts to whole cents that add up to their own rounded sum: each is cut to
 * the cent and the cents left over go to the largest remainders, so rounding
 * every line on its own cannot add up to a half cent per line.
 */
function scaledCents(amounts: number[]): number[] {
  const exact = amounts.map(amount => amount * 100);
  const cents = exact.map(value => Math.floor(value + 1e-9));
  let left =
    Math.round(exact.reduce((sum, value) => sum + value, 0)) - cents.reduce((a, b) => a + b, 0);
  const byRemainder = exact
    .map((value, index) => ({ index, rest: value - cents[index] }))
    .sort((a, b) => b.rest - a.rest);
  for (const { index } of byRemainder) {
    if (left <= 0) break;
    cents[index] += 1;
    left -= 1;
  }
  return cents;
}

/**
 * Moves the largest line's price until a partial credit's lines add up to its
 * target once each line's tax has been rounded. Never above the target; a cent
 * below when a tax step makes the exact sum unreachable.
 */
export async function fitToTarget(
  manager: EntityManager,
  lines: CreditNoteLineItem[],
  pricesIncludeTax: boolean,
  target: number,
): Promise<void> {
  const last = lines.reduce<CreditNoteLineItem | undefined>(
    (largest, line) =>
      !largest || Number(line.unitPrice) > Number(largest.unitPrice) ? line : largest,
    undefined,
  );
  if (!last) return;
  let best: { unitPrice: number; gap: number } | null = null;
  for (let step = 0; step < 8; step++) {
    const priced = await priceLines(manager, lines, pricesIncludeTax);
    const gap = round2(target - totalsOf(priced).total);
    const unit = Number(last.unitPrice);
    if (gap >= 0 && (!best || gap < best.gap)) best = { unitPrice: unit, gap };
    if (gap === 0) break;
    // How much of the line's price reaches its total (tax, discount), to move by the right step.
    const reach = unit > 0 ? fromMinor(priced[lines.indexOf(last)].grossMinor) / unit : 1;
    const move = round2(gap / (reach || 1)) || (gap > 0 ? 0.01 : -0.01);
    if (unit + move <= 0) break;
    last.unitPrice = round2(unit + move);
  }
  last.unitPrice = best?.unitPrice ?? last.unitPrice;
}
