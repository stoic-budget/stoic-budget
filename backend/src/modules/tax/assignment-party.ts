import type { Transaction } from '../../entities/transaction.entity';
import type { AssignmentInput } from './tax-assignment.service';

/**
 * Who a new row is with, for `resolve`: the supplier's country and VAT id set
 * once on the payee decide reverse charge on every row from it (#667), so
 * every path that creates a row passes these.
 */
export function partyOf(
  row: Partial<
    Pick<
      Transaction,
      | 'payeeId'
      | 'counterpartyName'
      | 'paymentPurpose'
      | 'counterpartyCountry'
      | 'counterpartyVatId'
    >
  >,
): Pick<
  AssignmentInput,
  'payeeId' | 'counterpartyName' | 'paymentPurpose' | 'counterpartyCountry' | 'counterpartyVatId'
> {
  return {
    payeeId: row.payeeId ?? null,
    counterpartyName: row.counterpartyName ?? null,
    paymentPurpose: row.paymentPurpose ?? null,
    counterpartyCountry: row.counterpartyCountry ?? null,
    counterpartyVatId: row.counterpartyVatId ?? null,
  };
}
