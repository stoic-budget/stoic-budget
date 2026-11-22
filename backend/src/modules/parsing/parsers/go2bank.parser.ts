import type { PdfTextRow } from '../../../common/utils/pdf-parser.util';
import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import type { LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The card issuer's customer care address and the available balance heading. */
const GO2BANK_CARE = /\bP\.O\. Box 5100,?\s*Pasadena, CA 91117\b/i;
const GO2BANK_TABLE = /\bAVAILABLE BALANCE\b/;
const GO2BANK_NAME = /\bGO2bank\b|\bGreen Dot\b/i;

export function isGo2bankStatement(text: string): boolean {
  return GO2BANK_TABLE.test(text) && (GO2BANK_CARE.test(text) || GO2BANK_NAME.test(text));
}

/** The kind printed on a row's second line: "Deposit", "ATM Withdrawal", "Fee", "Purchase". */
const KINDS: [RegExp, PaymentType][] = [
  [/^ATM Withdrawal\b/i, 'cash'],
  [/^Fee\b/i, 'fee'],
  [/^(?:Purchase|Refund)\b/i, 'card'],
  [/^Deposit\b/i, 'bank_transfer_in'],
];

export function go2bankEntry(row: ParsedTransaction): ParsedTransaction {
  const kindText = row.paymentPurpose.slice(row.counterpartyName.length).trim();
  const paymentType = KINDS.find(([pattern]) => pattern.test(kindText))?.[1];
  return paymentType ? { ...row, paymentType } : row;
}

/**
 * GO2bank (Green Dot, US) account statement: a summary, then Date,
 * Description and a signed Amount from the beginning balance, each row's
 * party on its first line and its kind ("Deposit", "Purchase", "ATM
 * Withdrawal", "Fee") on the second, with the place on a third. The generic
 * layout reading does the table and the balances; this names the bank, keeps
 * the first line as the party and types the row by its second.
 */
export class Go2bankParser extends BankPdfParser {
  protected readonly bank = BankName.GO2BANK;

  protected recognises(text: string): boolean {
    return isGo2bankStatement(text);
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return go2bankEntry(row);
  }

  protected readTransactions(rows: PdfTextRow[]): LayoutTransaction[] {
    return super
      .readTransactions(rows)
      .map(row => ({ ...row, counterparty: row.counterparty || row.firstLine }));
  }
}
