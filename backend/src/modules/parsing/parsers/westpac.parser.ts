import type { PdfTextRow } from '../../../common/utils/pdf-parser.util';
import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import { joinMoneyLastTable } from '../helpers/pdf-layout-money-last.helper';
import type { LayoutReading, LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's name in the notice over its table, and the BSB label. */
const WESTPAC_NAME = /\bWestpac\b/;
const WESTPAC_BSB = /\bBSB\b/;

export function isWestpacStatement(text: string): boolean {
  return WESTPAC_NAME.test(text) && WESTPAC_BSB.test(text);
}

const isHeader = (row: PdfTextRow) =>
  /^DATE TRANSACTION DESCRIPTION DEBIT CREDIT BALANCE$/i.test(row.text.trim());

const KINDS: [RegExp, PaymentType | 'transfer', RegExp?][] = [
  [/^Debit Card Purchase\b/i, 'card', /^Debit Card Purchase (.+?)(?: Usa| Aus\b|$)/i],
  [/\b(?:ATM|Cash) Withdrawal\b/i, 'cash'],
  [/\bFee\b(?!.*Purchase)/i, 'fee'],
  [/\bInterest\b/i, 'interest'],
  [
    /^(?:Deposit|Withdrawal|Payment|Transfer)\b/i,
    'transfer',
    /\bOsko Payment \d+ (.+?)(?: Deposit|$)/i,
  ],
];

export function westpacEntry(row: ParsedTransaction): ParsedTransaction {
  const text = row.paymentPurpose.replace(/\s+/g, ' ').trim();
  const found = KINDS.find(([pattern]) => pattern.test(text));
  if (!found) {
    return row;
  }
  const [, kind, partyPattern] = found;
  const paymentType =
    kind === 'transfer'
      ? Number(row.credit) > 0
        ? 'bank_transfer_in'
        : 'bank_transfer_out'
      : kind;
  const party = partyPattern?.exec(text)?.[1];
  return { ...row, paymentType, ...(party ? { counterpartyName: party } : {}) };
}

/**
 * Westpac (Australia) electronic statement: the account's BSB and number
 * and a summary from the opening to the closing balance, then Date,
 * Transaction Description, Debit, Credit and Balance, an entry over two or
 * three lines with its money on the last. This names the bank, lays each
 * entry out as one row for the generic layout reading and reads each row's
 * kind and party.
 */
export class WestpacParser extends BankPdfParser {
  protected readonly bank = BankName.WESTPAC;

  protected recognises(text: string): boolean {
    return isWestpacStatement(text);
  }

  protected readTransactions(rows: PdfTextRow[], reading?: LayoutReading): LayoutTransaction[] {
    return super.readTransactions(joinMoneyLastTable(rows, isHeader), reading);
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return westpacEntry(row);
  }
}
