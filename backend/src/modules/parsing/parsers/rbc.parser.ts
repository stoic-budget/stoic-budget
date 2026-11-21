import type { PdfTextRow } from '../../../common/utils/pdf-parser.util';
import type { PaymentType } from '../../../contracts/transactions/payment-type';
import { BankName } from '../../../entities/statement.entity';
import { joinMoneyLastTable } from '../helpers/pdf-layout-money-last.helper';
import type { LayoutReading, LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import type { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/** The bank's name and the statement's title. */
const RBC_NAME = /\bRoyal Bank of Canada\b/i;
const RBC_TITLE = /\bYour RBC (?:personal|business) banking\b/i;

export function isRbcStatement(text: string): boolean {
  return RBC_NAME.test(text) && RBC_TITLE.test(text);
}

const isHeader = (row: PdfTextRow) =>
  /^Date Description Withdrawals\b.*\bDeposits\b/i.test(row.text.trim());

const KINDS: [RegExp, PaymentType | 'transfer', RegExp?][] = [
  [/\bInterac purchase\b/i, 'card', /^(?:Contactless )?Interac purchase - \d+ (.+)$/i],
  [/^ATM (?:withdrawal|deposit)\b/i, 'cash'],
  [/\b(?:Monthly fee|INTERAC-SC|fee)\b/i, 'fee'],
  [/^e-Transfer sent\b/i, 'bank_transfer_out', /^e-Transfer sent (.+)$/i],
  [/^(?:e-Transfer|Payroll|Deposit)\b/i, 'bank_transfer_in'],
  [
    /^(?:Online Banking payment|Mortgage|Loan|Insurance|Misc Payment)\b/i,
    'direct_debit',
    /^(?:Online Banking payment - \d+|Mortgage|Loan|Insurance|Misc Payment) (.+)$/i,
  ],
  [/^(?:Funds transfer|BR TO BR)\b/i, 'transfer'],
];

export function rbcEntry(row: ParsedTransaction): ParsedTransaction {
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
 * RBC Royal Bank (Canada) personal banking statement: a summary from the
 * opening to the closing balance, then Date, Description, Withdrawals,
 * Deposits and Balance, the date once a day, an entry over two lines with
 * its money on the last ("Contactless Interac purchase - 1234" over "ACME
 * STORE  12.34"). This names the bank, lays each entry out as one row for
 * the generic layout reading, and reads each row's kind and party.
 */
export class RbcParser extends BankPdfParser {
  protected readonly bank = BankName.RBC;

  protected recognises(text: string): boolean {
    return isRbcStatement(text);
  }

  protected readTransactions(rows: PdfTextRow[], reading?: LayoutReading): LayoutTransaction[] {
    return super.readTransactions(joinMoneyLastTable(rows, isHeader), reading);
  }

  protected entry(row: ParsedTransaction): ParsedTransaction {
    return rbcEntry(row);
  }
}
