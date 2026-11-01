import { BankName } from '../../../entities/statement.entity';
import type { IParser } from '../interfaces/parser.interface';
import { AbsaParser } from '../parsers/absa.parser';
import { AllyParser } from '../parsers/ally.parser';
import { AnzParser } from '../parsers/anz.parser';
import { AssociatedParser } from '../parsers/associated.parser';
import { AtbParser } from '../parsers/atb.parser';
import { AxisParser } from '../parsers/axis.parser';
import { BancoDoBrasilParser } from '../parsers/banco-do-brasil.parser';
import { BankOfChinaParser } from '../parsers/bank-of-china.parser';
import { BankOfScotlandParser } from '../parsers/bank-of-scotland.parser';
import { BarclaysParser } from '../parsers/barclays.parser';
import { BecuParser } from '../parsers/becu.parser';
import { BendigoParser } from '../parsers/bendigo.parser';
import { BerekeNewParser } from '../parsers/bereke-new.parser';
import { BerekeOldParser } from '../parsers/bereke-old.parser';
import { BmoParser } from '../parsers/bmo.parser';
import { BnpParibasParser } from '../parsers/bnp-paribas.parser';
import { BoqParser } from '../parsers/boq.parser';
import { BpiParser } from '../parsers/bpi.parser';
import { Camt053Parser } from '../parsers/camt053.parser';
import { CapitalOneParser } from '../parsers/capital-one.parser';
import { CapitecParser } from '../parsers/capitec.parser';
import { CashAppParser } from '../parsers/cash-app.parser';
import { ChaseParser } from '../parsers/chase.parser';
import { CsvParser } from '../parsers/csv.parser';
import { DocxParser } from '../parsers/docx.parser';
import { ExcelParser } from '../parsers/excel.parser';
import { GenericPdfParser } from '../parsers/generic-pdf.parser';
import { HapoalimParser } from '../parsers/hapoalim.parser';
import { KaspiParser } from '../parsers/kaspi.parser';
import { Mt940Parser } from '../parsers/mt940.parser';
import { OfxParser } from '../parsers/ofx.parser';
import { QifParser } from '../parsers/qif.parser';
import { SchwabParser } from '../parsers/schwab.parser';

/**
 * Bank-specific parsers that may claim a file when its text names no bank,
 * in the order they are tried, with what each claims it as.
 */
export const FALLBACK_CLAIMS: [
  abstract new (...args: never[]) => IParser,
  { bankName: BankName; formatVersion?: string },
][] = [
  [KaspiParser, { bankName: BankName.KASPI }],
  [HapoalimParser, { bankName: BankName.HAPOALIM }],
  [AbsaParser, { bankName: BankName.ABSA }],
  [AllyParser, { bankName: BankName.ALLY }],
  [AnzParser, { bankName: BankName.ANZ }],
  [AssociatedParser, { bankName: BankName.ASSOCIATED }],
  [AtbParser, { bankName: BankName.ATB }],
  [AxisParser, { bankName: BankName.AXIS }],
  [BancoDoBrasilParser, { bankName: BankName.BANCO_DO_BRASIL }],
  [BankOfChinaParser, { bankName: BankName.BANK_OF_CHINA }],
  [BankOfScotlandParser, { bankName: BankName.BANK_OF_SCOTLAND }],
  [BarclaysParser, { bankName: BankName.BARCLAYS }],
  [BecuParser, { bankName: BankName.BECU }],
  [BendigoParser, { bankName: BankName.BENDIGO }],
  [BmoParser, { bankName: BankName.BMO }],
  [BnpParibasParser, { bankName: BankName.BNP_PARIBAS }],
  [BoqParser, { bankName: BankName.BOQ }],
  [BpiParser, { bankName: BankName.BPI }],
  [CapitalOneParser, { bankName: BankName.CAPITAL_ONE }],
  [CapitecParser, { bankName: BankName.CAPITEC }],
  [CashAppParser, { bankName: BankName.CASH_APP }],
  [SchwabParser, { bankName: BankName.SCHWAB }],
  [ChaseParser, { bankName: BankName.CHASE }],
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
    new KaspiParser(),
    new HapoalimParser(),
    new AbsaParser(),
    new AllyParser(),
    new AnzParser(),
    new AssociatedParser(),
    new AtbParser(),
    new AxisParser(),
    new BancoDoBrasilParser(),
    new BankOfChinaParser(),
    new BankOfScotlandParser(),
    new BarclaysParser(),
    new BecuParser(),
    new BendigoParser(),
    new BmoParser(),
    new BnpParibasParser(),
    new BoqParser(),
    new BpiParser(),
    new CapitalOneParser(),
    new CapitecParser(),
    new CashAppParser(),
    new SchwabParser(),
    new ChaseParser(),
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
