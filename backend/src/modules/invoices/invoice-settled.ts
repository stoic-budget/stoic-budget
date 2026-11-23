import type { EntityManager } from 'typeorm';
import { CreditNoteStatus } from '../../entities/credit-note.entity';
import type { Invoice } from '../../entities/invoice.entity';
import { PayableStatus } from '../../entities/payable.entity';

/**
 * Whether money has moved on the invoice: its receivable is paid or partly
 * paid, or an issued credit note is applied to it. Voiding then would reverse
 * revenue for money already received or already credited.
 */
export async function invoiceSettled(
  manager: EntityManager,
  invoice: Pick<Invoice, 'id' | 'payableId' | 'workspaceId'>,
): Promise<boolean> {
  const [row] = await manager.query(
    `SELECT EXISTS (
        SELECT 1 FROM payables p
         WHERE p.id = $1 AND (p.status = $3 OR p.paid_amount > 0)
      ) OR EXISTS (
        SELECT 1 FROM credit_note_applications a
          JOIN credit_notes n ON n.id = a.credit_note_id
         WHERE a.invoice_id = $2 AND a.workspace_id = $4 AND n.status = $5
      ) AS settled`,
    [
      invoice.payableId,
      invoice.id,
      PayableStatus.PAID,
      invoice.workspaceId,
      CreditNoteStatus.ISSUED,
    ],
  );
  return Boolean(row?.settled);
}
