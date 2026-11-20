import { BankName } from '../../../entities/statement.entity';
import type { IParser } from '../interfaces/parser.interface';
import { AbsaParser } from '../parsers/absa.parser';
import { AllyParser } from '../parsers/ally.parser';
import { AnzParser } from '../parsers/anz.parser';
import { AssociatedParser } from '../parsers/associated.parser';
import { AtbParser } from '../parsers/atb.parser';
import { AxisParser } from '../parsers/axis.parser';
import { BancoDoBrasilParser } from '../parsers/banco-do-brasil.parser';
import { BankOfAmericaParser } from '../parsers/bank-of-america.parser';
import { BankOfChinaParser } from '../parsers/bank-of-china.parser';
import { BankOfScotlandParser } from '../parsers/bank-of-scotland.parser';
import { BarclaysParser } from '../parsers/barclays.parser';
import { BecuParser } from '../parsers/becu.parser';
import { BendigoParser } from '../parsers/bendigo.parser';
import { BmoParser } from '../parsers/bmo.parser';
import { BnpParibasParser } from '../parsers/bnp-paribas.parser';
import { BoqParser } from '../parsers/boq.parser';
import { BpiParser } from '../parsers/bpi.parser';
import { CapitalOneParser } from '../parsers/capital-one.parser';
import { CapitecParser } from '../parsers/capitec.parser';
import { CashAppParser } from '../parsers/cash-app.parser';
import { ChaseParser } from '../parsers/chase.parser';
import { ChimeParser } from '../parsers/chime.parser';
import { CibcParser } from '../parsers/cibc.parser';
import { CitiParser } from '../parsers/citi.parser';
import { CitizensParser } from '../parsers/citizens.parser';
import { CoastCapitalParser } from '../parsers/coast-capital.parser';
import { ComericaParser } from '../parsers/comerica.parser';
import { CommBankParser } from '../parsers/commbank.parser';
import { CommerceBankParser } from '../parsers/commerce-bank.parser';
import { CommercialBankParser } from '../parsers/commercial-bank.parser';
import { CreditAgricoleParser } from '../parsers/credit-agricole.parser';
import { CreditOneParser } from '../parsers/credit-one.parser';
import { DcuParser } from '../parsers/dcu.parser';
import { DesjardinsParser } from '../parsers/desjardins.parser';
import { DeutscheBankParser } from '../parsers/deutsche-bank.parser';
import { DiscoverParser } from '../parsers/discover.parser';
import { EqBankParser } from '../parsers/eq-bank.parser';
import { FidelityBankParser } from '../parsers/fidelity-bank.parser';
import { FifthThirdParser } from '../parsers/fifth-third.parser';
import { HapoalimParser } from '../parsers/hapoalim.parser';
import { KaspiParser } from '../parsers/kaspi.parser';
import { SchwabParser } from '../parsers/schwab.parser';

/**
 * Each bank's own parser, with the bank it claims a file as when the file's
 * text names no bank, in the order they are tried. A new bank adds a line.
 */
export const BANK_PARSERS: [new () => IParser, { bankName: BankName }][] = [
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
  [ChimeParser, { bankName: BankName.CHIME }],
  [CibcParser, { bankName: BankName.CIBC }],
  [CitiParser, { bankName: BankName.CITI }],
  [CitizensParser, { bankName: BankName.CITIZENS }],
  [CoastCapitalParser, { bankName: BankName.COAST_CAPITAL }],
  [ComericaParser, { bankName: BankName.COMERICA }],
  [CommBankParser, { bankName: BankName.COMMBANK }],
  [CommerceBankParser, { bankName: BankName.COMMERCE_BANK }],
  [CommercialBankParser, { bankName: BankName.COMMERCIAL_BANK }],
  [CreditAgricoleParser, { bankName: BankName.CREDIT_AGRICOLE }],
  [CreditOneParser, { bankName: BankName.CREDIT_ONE }],
  [DcuParser, { bankName: BankName.DCU }],
  [BankOfAmericaParser, { bankName: BankName.BANK_OF_AMERICA }],
  [DesjardinsParser, { bankName: BankName.DESJARDINS }],
  [DeutscheBankParser, { bankName: BankName.DEUTSCHE_BANK }],
  [DiscoverParser, { bankName: BankName.DISCOVER }],
  [EqBankParser, { bankName: BankName.EQ_BANK }],
  [FidelityBankParser, { bankName: BankName.FIDELITY_BANK }],
  [FifthThirdParser, { bankName: BankName.FIFTH_THIRD }],
];
