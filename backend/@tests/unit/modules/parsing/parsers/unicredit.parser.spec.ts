import type { PdfTextRow } from '@/common/utils/pdf-parser.util';
import { BankName, FileType } from '@/entities/statement.entity';
import type { LayoutTransaction } from '@/modules/parsing/helpers/pdf-layout-table.helper';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import {
  UnicreditParser,
  isUnicreditStatement,
  unicreditEntry,
  withKindLines,
} from '@/modules/parsing/parsers/unicredit.parser';

const STATEMENT = ['Estratto conto al', 'Codice BIC SWIFT: UNCRITM1AA0', 'Conto Corrente: 000100000001 - Valuta in EURO'].join('\n');

const line = (y: number, words: [string, number][]): PdfTextRow => ({
  page: 1,
  y,
  text: words.map(([text]) => text).join(' '),
  items: words.map(([text, x]) => ({ text, x, y, width: text.length * 5, height: 8, page: 1 })),
});
const read = (y: number, description: string): LayoutTransaction => ({
  date: { day: 1, month: 4, year: 2022 },
  dateText: '01.04.22',
  description,
  firstLine: description,
  counterparty: '',
  debit: 1,
  at: { page: 1, y },
});

const row = (paymentPurpose: string, amount: { debit?: number; credit?: number }): ParsedTransaction => ({
  transactionDate: new Date(2022, 3, 1),
  paymentPurpose,
  counterpartyName: paymentPurpose,
  currency: 'EUR',
  ...amount,
});

describe('UnicreditParser', () => {
  it('knows its statement by its BIC and title', () => {
    expect(isUnicreditStatement(STATEMENT)).toBe(true);
    expect(isUnicreditStatement('Estratto conto al')).toBe(false);
  });

  it('parses its files under its own bank or OTHER, and PDFs only', async () => {
    const parser = new UnicreditParser();
    const claims = (bank: BankName, type = FileType.PDF) =>
      parser.canParse(bank, type, 'x.pdf', STATEMENT);
    await expect(claims(BankName.UNICREDIT)).resolves.toBe(true);
    await expect(claims(BankName.OTHER)).resolves.toBe(true);
    await expect(claims(BankName.ING)).resolves.toBe(false);
    await expect(claims(BankName.UNICREDIT, FileType.CSV)).resolves.toBe(false);
  });

  it('gives each movement the kind line printed above its dates', () => {
    const rows = [
      line(458, [['PAGAMENTO', 128], ['Contactless', 181]]),
      line(466, [['01.04.22', 47], ['29.03.22', 88], ['CARTA', 128]]),
      line(477, [['DISPOSIZIONE', 128], ['DI', 187], ['BONIFICO', 199]]),
      line(486, [['01.04.22', 47], ['01.04.22', 88], ['BONIFICO', 128]]),
    ];
    const fixed = withKindLines(rows, [read(466, 'CARTA DISPOSIZIONE DI BONIFICO'), read(486, 'BONIFICO')]);
    expect(fixed.map(movement => movement.description)).toEqual([
      'PAGAMENTO Contactless CARTA',
      'DISPOSIZIONE DI BONIFICO BONIFICO',
    ]);
  });

  it.each([
    ['PAGAMENTO Contactless del 29/03/2022 CARTA *1000 DI EUR 3,00 ACME STORE SAMPLETOWN', { debit: 3 }, 'ACME STORE SAMPLETOWN', 'card'],
    ['BONIFICO A VOSTRO FAVORE BONIFICO SEPA DA: MEMBER ONE COMM: 0,00 SPESE: 0,00', { credit: 100 }, 'MEMBER ONE', 'bank_transfer_in'],
  ])('reads %s', (purpose, amount, payee, paymentType) => {
    expect(unicreditEntry(row(purpose, amount))).toMatchObject({ counterpartyName: payee, paymentType });
  });
});
