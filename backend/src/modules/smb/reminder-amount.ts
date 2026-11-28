import type { Repository } from 'typeorm';
import type { Invoice } from '../../entities/invoice.entity';
import { type Payable, PayableStatus } from '../../entities/payable.entity';

/**
 * What a reminder asks the client for: what is left on the receivable (a
 * credit note lowers it too), or the invoice total when it has none. Null
 * once the receivable is settled: the stored invoice status stays 'sent'
 * after payment, so it cannot say that.
 */
export async function amountToRemind(
  payables: Repository<Payable>,
  invoice: Invoice,
  workspaceId: string,
): Promise<number | null> {
  if (!invoice.payableId) {
    return Number(invoice.total);
  }
  const owed = await payables.findOne({ where: { id: invoice.payableId, workspaceId } });
  if (!owed) {
    return Number(invoice.total);
  }
  if (owed.status === PayableStatus.PAID || owed.status === PayableStatus.ARCHIVED) {
    return null;
  }
  return Math.round((Number(owed.amount) - Number(owed.paidAmount ?? 0)) * 100) / 100;
}

/**
 * The reminder's line for a partly paid invoice: the total stays the
 * invoice's, and this says what is left of it. Empty when all of it is open.
 */
export function openSentence(locale: string, due: number, invoice: Invoice): string {
  if (!(due < Number(invoice.total))) {
    return '';
  }
  const amount = `${due.toFixed(2)} ${invoice.currency}`;
  return locale === 'ru'
    ? ` Из этой суммы осталось оплатить ${amount}.`
    : ` Of this, ${amount} is still open.`;
}
