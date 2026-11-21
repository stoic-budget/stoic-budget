import type { PaymentType } from '../../../contracts/transactions/payment-type';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';

/**
 * The payment type codes UK banks print before a row's text (HSBC and first
 * direct, Lloyds, Halifax, NatWest and others): "VIS ACME STORE", "DD
 * ACME ENERGY", "))) ACME CAFE" for contactless. A code that names a
 * transfer without its side ("TFR") takes it from the money.
 */
const CODES: Record<string, PaymentType | 'transfer'> = {
  CR: 'bank_transfer_in',
  BGC: 'bank_transfer_in',
  BAC: 'bank_transfer_in',
  FPI: 'bank_transfer_in',
  BP: 'bank_transfer_out',
  OBP: 'bank_transfer_out',
  FPO: 'bank_transfer_out',
  TFR: 'transfer',
  DD: 'direct_debit',
  SO: 'standing_order',
  STO: 'standing_order',
  VIS: 'card',
  DEB: 'card',
  POS: 'card',
  ')))': 'card',
  ATM: 'cash',
  CPT: 'cash',
  CSH: 'cash',
  INT: 'interest',
  CHG: 'fee',
};

const CODE = /^(\){3}|[A-Z]{2,3})\s+(?=\S)/;

/**
 * A row whose text starts with a UK payment type code: its type, and its
 * party without the code. Any other row is left as it is.
 */
export function ukCodeEntry(row: ParsedTransaction): ParsedTransaction {
  const text = row.paymentPurpose.replace(/\s+/g, ' ').trim();
  const match = CODE.exec(text);
  const kind = match ? CODES[match[1]] : undefined;
  if (!(match && kind)) {
    return row;
  }
  const paymentType =
    kind === 'transfer'
      ? Number(row.credit) > 0
        ? 'bank_transfer_in'
        : 'bank_transfer_out'
      : kind;
  const party = text.slice(match[0].length);
  return {
    ...row,
    paymentType,
    counterpartyName: row.counterpartyName === row.paymentPurpose ? party : row.counterpartyName,
  };
}
