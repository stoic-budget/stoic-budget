import { BankName } from '../../../entities/statement.entity';
import type { IParser } from '../interfaces/parser.interface';
import { BerekeNewParser } from '../parsers/bereke-new.parser';
import { BerekeOldParser } from '../parsers/bereke-old.parser';
import { Camt053Parser } from '../parsers/camt053.parser';
import { CsvParser } from '../parsers/csv.parser';
import { DocxParser } from '../parsers/docx.parser';
import { ExcelParser } from '../parsers/excel.parser';
import { GenericPdfParser } from '../parsers/generic-pdf.parser';
import { Mt940Parser } from '../parsers/mt940.parser';
import { OfxParser } from '../parsers/ofx.parser';
import { QifParser } from '../parsers/qif.parser';
import { BANK_PARSERS } from './bank-parsers';

/**
 * Bank-specific parsers that may claim a file when its text names no bank,
 * in the order they are tried, with what each claims it as.
 */
export const FALLBACK_CLAIMS: [
  abstract new (...args: never[]) => IParser,
  { bankName: BankName; formatVersion?: string },
][] = [
  ...BANK_PARSERS,
  [BerekeNewParser, { bankName: BankName.BEREKE_NEW, formatVersion: 'new' }],
  [BerekeOldParser, { bankName: BankName.BEREKE_OLD, formatVersion: 'old' }],
];

/**
 * Every parser, in the order the factory asks them: bank-specific parsers
 * before the generic ones they extend or would otherwise be shadowed by.
 */
export function createParsers(): IParser[] {
  return [
    new BerekeNewParser(),
    new BerekeOldParser(),
    ...BANK_PARSERS.map(([BankParser]) => new BankParser()),
    new GenericPdfParser(),
    new ExcelParser(),
    new CsvParser(),
    new DocxParser(),
    new OfxParser(),
    new QifParser(),
    new Camt053Parser(),
    new Mt940Parser(),
  ];
}
