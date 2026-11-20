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
import { FirstCitizensParser } from '../parsers/first-citizens.parser';
import { FirstDirectParser } from '../parsers/first-direct.parser';
import { FnbParser } from '../parsers/fnb.parser';
import { FoundParser } from '../parsers/found.parser';
import { FrostParser } from '../parsers/frost.parser';
import { Go2bankParser } from '../parsers/go2bank.parser';
import { GotymeParser } from '../parsers/gotyme.parser';
import { GreatSouthernParser } from '../parsers/great-southern.parser';
import { GreenDotParser } from '../parsers/green-dot.parser';
import { HalifaxParser } from '../parsers/halifax.parser';
import { HandelsbankenParser } from '../parsers/handelsbanken.parser';
import { HapoalimParser } from '../parsers/hapoalim.parser';
import { HdfcParser } from '../parsers/hdfc.parser';
import { HeritageParser } from '../parsers/heritage.parser';
import { HsaBankParser } from '../parsers/hsa-bank.parser';
import { HsbcParser } from '../parsers/hsbc.parser';
import { HuntingtonParser } from '../parsers/huntington.parser';
import { IbcParser } from '../parsers/ibc.parser';
import { IciciParser } from '../parsers/icici.parser';
import { IfastParser } from '../parsers/ifast.parser';
import { IngParser } from '../parsers/ing.parser';
import { KaspiParser } from '../parsers/kaspi.parser';
import { KbcParser } from '../parsers/kbc.parser';
import { KeybankParser } from '../parsers/keybank.parser';
import { KrooParser } from '../parsers/kroo.parser';
import { LaurentianParser } from '../parsers/laurentian.parser';
import { LloydsParser } from '../parsers/lloyds.parser';
import { MAndTParser } from '../parsers/m-and-t.parser';
import { MarcusParser } from '../parsers/marcus.parser';
import { MerrickParser } from '../parsers/merrick.parser';
import { MetroBankParser } from '../parsers/metro-bank.parser';
import { MonzoParser } from '../parsers/monzo.parser';
import { N26Parser } from '../parsers/n26.parser';
import { NabParser } from '../parsers/nab.parser';
import { NationwideParser } from '../parsers/nationwide.parser';
import { NatwestParser } from '../parsers/natwest.parser';
import { NavyFederalParser } from '../parsers/navy-federal.parser';
import { NcbaParser } from '../parsers/ncba.parser';
import { NetspendParser } from '../parsers/netspend.parser';
import { OptumParser } from '../parsers/optum.parser';
import { PayoneerParser } from '../parsers/payoneer.parser';
import { PaypalParser } from '../parsers/paypal.parser';
import { PncParser } from '../parsers/pnc.parser';
import { ProsperityParser } from '../parsers/prosperity.parser';
import { QnbParser } from '../parsers/qnb.parser';
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
  [FirstCitizensParser, { bankName: BankName.FIRST_CITIZENS }],
  [FirstDirectParser, { bankName: BankName.FIRST_DIRECT }],
  [FnbParser, { bankName: BankName.FNB }],
  [FoundParser, { bankName: BankName.FOUND }],
  [FrostParser, { bankName: BankName.FROST }],
  [Go2bankParser, { bankName: BankName.GO2BANK }],
  [GotymeParser, { bankName: BankName.GOTYME }],
  [GreatSouthernParser, { bankName: BankName.GREAT_SOUTHERN }],
  [GreenDotParser, { bankName: BankName.GREEN_DOT }],
  [HalifaxParser, { bankName: BankName.HALIFAX }],
  [HandelsbankenParser, { bankName: BankName.HANDELSBANKEN }],
  [HdfcParser, { bankName: BankName.HDFC }],
  [HeritageParser, { bankName: BankName.HERITAGE }],
  [HsaBankParser, { bankName: BankName.HSA_BANK }],
  [HsbcParser, { bankName: BankName.HSBC }],
  [HuntingtonParser, { bankName: BankName.HUNTINGTON }],
  [IbcParser, { bankName: BankName.IBC }],
  [IciciParser, { bankName: BankName.ICICI }],
  [IfastParser, { bankName: BankName.IFAST }],
  [IngParser, { bankName: BankName.ING }],
  [KbcParser, { bankName: BankName.KBC }],
  [KeybankParser, { bankName: BankName.KEYBANK }],
  [KrooParser, { bankName: BankName.KROO }],
  [LaurentianParser, { bankName: BankName.LAURENTIAN }],
  [LloydsParser, { bankName: BankName.LLOYDS }],
  [MAndTParser, { bankName: BankName.M_AND_T }],
  [MarcusParser, { bankName: BankName.MARCUS }],
  [MerrickParser, { bankName: BankName.MERRICK }],
  [MetroBankParser, { bankName: BankName.METRO_BANK }],
  [MonzoParser, { bankName: BankName.MONZO }],
  [N26Parser, { bankName: BankName.N26 }],
  [NabParser, { bankName: BankName.NAB }],
  [NationwideParser, { bankName: BankName.NATIONWIDE }],
  [NatwestParser, { bankName: BankName.NATWEST }],
  [NavyFederalParser, { bankName: BankName.NAVY_FEDERAL }],
  [NcbaParser, { bankName: BankName.NCBA }],
  [NetspendParser, { bankName: BankName.NETSPEND }],
  [OptumParser, { bankName: BankName.OPTUM }],
  [PayoneerParser, { bankName: BankName.PAYONEER }],
  [PaypalParser, { bankName: BankName.PAYPAL }],
  [PncParser, { bankName: BankName.PNC }],
  [ProsperityParser, { bankName: BankName.PROSPERITY }],
  [QnbParser, { bankName: BankName.QNB }],
];
