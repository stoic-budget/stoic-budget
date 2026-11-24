import type { CreditNoteLineItem } from '../../entities/credit-note-line-item.entity';
import type { Invoice } from '../../entities/invoice.entity';
import type { InvoiceLineItem } from '../../entities/invoice-line-item.entity';

/** One invoice's share of a credit note, resolved against what it can carry. */
export interface ResolvedApplication {
  invoice: Invoice;
  lines: InvoiceLineItem[];
  /** How much of the invoice is credited, as a share of its total. */
  factor: number;
  /** What is left on the invoice to credit: the most this note may take off it. */
  creditable: number;
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
  return application.lines.flatMap(line => {
    const amount = Number(line.quantity) * Number(line.unitPrice);
    const unitPrice = whole ? Number(line.unitPrice) : round2(amount * application.factor);
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
