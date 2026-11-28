// Behaviour ported from zumfi-finance (MIT, © 2026 Simmak7), commit a5b8a09.
// See THIRD_PARTY_NOTICES.md.
import { extractTextFromPdf, type PdfTextRow } from '../../../common/utils/pdf-parser.util';
import { BankName } from '../../../entities/statement.entity';
import { asTextRow, rowBlocks } from '../helpers/pdf-layout-blocks.helper';
import { withoutStackedDates } from '../helpers/pdf-layout-stacked-dates.helper';
import type { LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import {
  findAccountCurrency,
  findCzechAccount,
  readPaymentSymbols,
  withoutCzechAccount,
} from '../helpers/statement-czech-account.helper';
import { findForeignAmount } from '../helpers/statement-foreign-amount.helper';
import { detectStatementCurrency } from '../helpers/statement-metadata.helper';
import type { ParsedStatement } from '../interfaces/parsed-statement.interface';
import { BankPdfParser } from './bank-pdf.parser';

/**
 * Fio banka (Czech Republic, and its Slovak branch) account statement. Each
 * row is a block: the booking date, the kind of operation, the counterparty's
 * account and the amount on its first line; under it the day of the payment
 * with the card merchant ("Nákup: …"), the counterparty's name or message,
 * the operation's id with its payment symbols ("27514078527 VS: 7070") and,
 * for a payment abroad, the original amount ("dne 6.3.2026, částka 50.00 PLN").
 *
 * The generic layout reading does the table, the balances and the checks;
 * this names the bank, keeps the foreign amount line as text, and reads each
 * row's payee, account, reference and original amount from its block.
 */

/**
 * The bank as the header names it: a line opening with its name (any case and
 * spacing) or with its BIC after the label, or its site. A row's text names
 * the bank mid-line ("Příchozí SEPA platba FIOBCZPPXXX").
 */
const FIO_BANK = /^\s*(?:fio\s?banka\b|BIC:?\s*FIO(?:BCZPP|ZSKBA))|\bfio\.(?:cz|sk)\b/im;
/** The account's own IBAN, printed in the header: a Fio account's carries Fio's bank code. */
const HEADER_IBAN = /^\s*IBAN:?\s*[A-Z]{2}\d{2}\s?(\d{4})/m;
const FIO_BANK_CODES = ['2010', '8330'];
/** The account's currency line, which only the statement's own header prints. */
const FIO_HEADER = /\bM[eě]na\s+(?:účtu|uctu)\b/u;
/** The header's lines: another bank's statement may name Fio in a row far below them. */
const HEADER_LINES = 15;

/**
 * A Fio statement names the bank in its header and prints the account's
 * currency there. A row of another bank's statement can name Fio too (a
 * payment from a Fio account, "BIC FIOBCZPPXXX"), but not in the first lines.
 */
export function isFioStatement(text: string): boolean {
  const head = text.split('\n').slice(0, HEADER_LINES).join('\n');
  const iban = head.match(HEADER_IBAN);
  return (
    FIO_BANK.test(head) && FIO_HEADER.test(text) && (!iban || FIO_BANK_CODES.includes(iban[1]))
  );
}

/** The foreign amount under a card payment; its figure is no movement of the account's. */
const FOREIGN_TAIL = /^(?:dne\s+\d{1,2}\.\d{1,2}\.\d{4}|č[aá]stka\s)/iu;

/** Header and footer lines printed on every page, in Czech and Slovak. */
const NOISE_EXACT = new Set([
  'Výpis operácií',
  'Výpis operací',
  'Výpis z účtu',
  'Správa pre príjemcu',
  'Správa pro příjemce',
  'Užívateľský symbol',
  'Uživatelský symbol',
  'Slovensko',
  'Česká republika',
]);
const NOISE_PREFIX = [
  'Číslo účtu',
  'Vložka číslo',
  'Vložka č.',
  'Dátum zaúčtovania',
  'Datum zaúčtování',
  'Dátum transakcie',
  'Datum transakce',
  'ID operácie',
  'ID operace',
  'IBAN',
  'BIC',
  'Typ účtu',
  'Dátum zriadenia',
  'Datum založení',
  'Mena účtu',
  'Měna účtu',
  'Dátum výpisu',
  'Datum výpisu',
  'Výpis za obdobie',
  'Výpis za období',
  'Starý zostatok',
  'Počáteční zůstatek',
  'Nový zostatok',
  'Konečný zůstatek',
  'Suma príjmov',
  'Suma výdavkov',
  'Součet příjmů',
  'Součet výdajů',
  'Majiteľ účtu',
  'Majitel účtu',
  'Vklad na tomto úč',
  'k dispozícii na webových',
  'k dispozici na webových',
  'Fio banka',
  '====',
];
const PAGE_NUMBER = /^\d+\s*z\s*\d+$/;

function isNoise(line: string): boolean {
  return (
    NOISE_EXACT.has(line) ||
    NOISE_PREFIX.some(prefix => line.startsWith(prefix)) ||
    PAGE_NUMBER.test(line)
  );
}

/** Lines under a row that name nobody: the operation's id and symbols, a bare date, the foreign amount. */
const JUNK = [
  /^\d{8,}(?:\s+(?:VS|KS|SS|REF|SYM):.*)?$/,
  /^\d{8,}\s*$/,
  /^\d{1,2}\.\d{1,2}\.\d{4}\s*$/,
  /^dne\s+\d{1,2}\.\d{1,2}\.\d{4}/,
  /^č[aá]stka\s+/iu,
];

const BARE_DATE = /^\d{1,2}\.\d{1,2}\.\d{4}\s*$/;
/** The operation's id and symbols printed on the payee's own line, right of the name. */
const TRAILING_ID = /\s+\d{8,}(?:\s+(?:VS|KS|SS|REF|SYM):.*)?$/;

/** The first line's text between its date and its amount: the operation and the counterparty's account. */
const OPERATION = /^\d{1,2}\.\d{1,2}\.\d{4}\s+(.+?)\s+-?\d{1,3}(?:\s\d{3})*,\d{2}\s*$/;

/**
 * Who the row was with, the way the block names them: the card merchant, the
 * cash machine, the sender of a deposit, else the first line that names
 * someone, else the operation itself.
 */
export function fioPayee(operation: string, lines: string[]): string {
  const meaningful = lines
    .filter(line => !JUNK.some(pattern => pattern.test(line)))
    .map(line => line.replace(TRAILING_ID, ''));
  for (const line of meaningful) {
    const purchase = line.match(/Nákup:\s*([^,]+)/u);
    if (purchase) {
      return purchase[1].trim();
    }
  }
  for (const line of meaningful) {
    const atm = line.match(/Vklad\s+do\s+bankomatu:\s*([^,]+)/u);
    if (atm) {
      return `Vklad do bankomatu: ${atm[1].trim()}`;
    }
  }
  for (const line of meaningful) {
    const deposit = line.match(/Bezhotovostn[ýí]\s+vklad\s+(.+)$/u);
    if (deposit) {
      return deposit[1].trim();
    }
  }
  const named = meaningful.find(line => !BARE_DATE.test(line));
  return named ?? (withoutCzechAccount(operation) || operation);
}

/** The lines of each row's block, page headers left out. */
function blockLines(rows: PdfTextRow[], read: LayoutTransaction[]): string[][] {
  // The day of the payment printed under the booking date is no part of the row's text.
  return rowBlocks(withoutStackedDates(rows), read).map(block =>
    block.map(line => line.text.trim()).filter(line => line && !isNoise(line)),
  );
}

function accountCurrency(text: string): string {
  return findAccountCurrency(text) ?? detectStatementCurrency(text) ?? 'CZK';
}

export class FioParser extends BankPdfParser {
  protected readonly bank = BankName.FIO;

  protected recognises(text: string): boolean {
    return isFioStatement(text);
  }

  /** The account's currency is the one its header names, whatever the foreign amounts print. */
  async parse(filePath: string, cachedText?: string): Promise<ParsedStatement> {
    const text = cachedText ?? (await extractTextFromPdf(filePath));
    const statement = await super.parse(filePath, text);
    const currency = accountCurrency(text);
    return {
      ...statement,
      metadata: { ...statement.metadata, currency },
      transactions: statement.transactions.map(row => ({ ...row, currency })),
    };
  }

  protected readTransactions(rows: PdfTextRow[]): LayoutTransaction[] {
    const lines = rows.map(row => (FOREIGN_TAIL.test(row.text.trim()) ? asTextRow(row) : row));
    const read = super.readTransactions(lines);
    const currency = accountCurrency(rows.map(row => row.text).join('\n'));
    const blocks = blockLines(rows, read);
    return read.map((transaction, index) => {
      const [first = '', ...under] = blocks[index];
      const operation = first.match(OPERATION)?.[1] ?? transaction.firstLine;
      const symbols = readPaymentSymbols(under.join('\n'));
      const foreign = findForeignAmount(under.join('\n'), currency, transaction.amount);
      const account = findCzechAccount(operation);
      return {
        ...transaction,
        counterparty: fioPayee(operation, under),
        description: [operation, ...under.filter(line => !JUNK[0].test(line))].join(' '),
        ...(account && { counterpartyAccount: account }),
        ...(symbols.vs && { documentNumber: symbols.vs }),
        ...(foreign && { amountForeign: foreign.amount, exchangeRate: foreign.rate }),
      };
    });
  }
}
