/**
 * Every bank with a parser of its own, one line each.
 *
 * - `key`: the bank as statements store it (the backend's BankName; both
 *   Bereke layouts are `bereke`).
 * - `name`: how the app names it.
 * - `logo`: the file under /images/bank-logo/.
 * - `aliases`: other names a typed-in bank name may start with. The key, with
 *   spaces for underscores, is always one. `anywhere` matches a name anywhere
 *   in the text instead ("Bereke Bank JSC").
 */
export type BankEntry = {
  key: string;
  name: string;
  logo: string;
  aliases?: readonly string[];
  anywhere?: boolean;
};

export const BANKS = [
  { key: 'kaspi', name: 'Kaspi', logo: 'kaspi.png', anywhere: true },
  { key: 'bereke', name: 'Bereke', logo: 'bereke-bank.png', anywhere: true },
  { key: 'hapoalim', name: 'Bank Hapoalim', logo: 'bank.png', anywhere: true },
  { key: 'absa', name: 'Absa Bank', logo: 'absa.png' },
  { key: 'ally', name: 'Ally Bank', logo: 'bank.png' },
  { key: 'anz', name: 'ANZ', logo: 'anz.png' },
  { key: 'associated', name: 'Associated Bank', logo: 'associated.png' },
  { key: 'atb', name: 'ATB Financial', logo: 'atb.png' },
  { key: 'axis', name: 'Axis Bank', logo: 'axis.png' },
  { key: 'banco_do_brasil', name: 'Banco do Brasil', logo: 'banco-do-brasil.png' },
  { key: 'bank_of_china', name: 'Bank of China (Hong Kong)', logo: 'bank-of-china.png' },
  { key: 'bank_of_scotland', name: 'Bank of Scotland', logo: 'bank-of-scotland.png' },
  { key: 'barclays', name: 'Barclays', logo: 'barclays.png' },
  { key: 'becu', name: 'BECU', logo: 'becu.png' },
  { key: 'bendigo', name: 'Bendigo Bank', logo: 'bendigo.png' },
  { key: 'bmo', name: 'BMO', logo: 'bmo.png' },
  { key: 'bnp_paribas', name: 'BNP Paribas', logo: 'bnp-paribas.png' },
  { key: 'boq', name: 'BOQ', logo: 'boq.png', aliases: ['bank of queensland'] },
  { key: 'bpi', name: 'BPI', logo: 'bpi.png', aliases: ['bank of the philippine islands'] },
  { key: 'capital_one', name: 'Capital One', logo: 'capital-one.png' },
  { key: 'capitec', name: 'Capitec', logo: 'capitec.png' },
  { key: 'cash_app', name: 'Cash App', logo: 'cash-app.png' },
  { key: 'schwab', name: 'Charles Schwab', logo: 'schwab.png', aliases: ['charles schwab'] },
  { key: 'chase', name: 'Chase', logo: 'chase.png', aliases: ['jpmorgan chase'] },
  { key: 'chime', name: 'Chime', logo: 'chime.png' },
  { key: 'cibc', name: 'CIBC', logo: 'cibc.png' },
  { key: 'citi', name: 'Citi', logo: 'citi.png', aliases: ['citibank'] },
  { key: 'citizens', name: 'Citizens', logo: 'citizens.png' },
  { key: 'coast_capital', name: 'Coast Capital', logo: 'coast-capital.png' },
  { key: 'comerica', name: 'Comerica', logo: 'comerica.png' },
  { key: 'commbank', name: 'CommBank', logo: 'commbank.png', aliases: ['commonwealth bank'] },
  { key: 'commerce_bank', name: 'Commerce Bank', logo: 'commerce-bank.png' },
  { key: 'commercial_bank', name: 'Commercial Bank', logo: 'commercial-bank.png' },
  {
    key: 'credit_agricole',
    name: 'Crédit Agricole',
    logo: 'credit-agricole.png',
    aliases: ['crédit agricole'],
  },
  { key: 'credit_one', name: 'Credit One', logo: 'credit-one.png' },
  { key: 'dcu', name: 'DCU', logo: 'dcu.png', aliases: ['digital federal credit union'] },
  {
    key: 'bank_of_america',
    name: 'Bank of America',
    logo: 'bank-of-america.png',
    aliases: ['bofa'],
  },
  { key: 'desjardins', name: 'Desjardins', logo: 'desjardins.png', aliases: ['caisse desjardins'] },
  { key: 'deutsche_bank', name: 'Deutsche Bank', logo: 'deutsche-bank.png' },
  { key: 'discover', name: 'Discover', logo: 'discover.png', aliases: ['discover bank'] },
  { key: 'eq_bank', name: 'EQ Bank', logo: 'eq-bank.png', aliases: ['equitable bank'] },
  { key: 'fidelity_bank', name: 'Fidelity Bank', logo: 'fidelity-bank.png' },
  {
    key: 'fifth_third',
    name: 'Fifth Third',
    logo: 'fifth-third.png',
    aliases: ['fifth third bank', '53 bank'],
  },
  {
    key: 'first_citizens',
    name: 'First Citizens',
    logo: 'first-citizens.png',
    aliases: ['first citizens bank'],
  },
  { key: 'first_direct', name: 'first direct', logo: 'first-direct.png' },
  { key: 'fnb', name: 'FNB', logo: 'fnb.png', aliases: ['first national bank'] },
  { key: 'found', name: 'Found', logo: 'found.png' },
  { key: 'frost', name: 'Frost Bank', logo: 'frost.png', aliases: ['frost'] },
  { key: 'go2bank', name: 'GO2bank', logo: 'go2bank.png', aliases: ['go2 bank'] },
  { key: 'gotyme', name: 'GoTyme Bank', logo: 'gotyme.png', aliases: ['gotyme'] },
  {
    key: 'great_southern',
    name: 'Great Southern Bank',
    logo: 'great-southern.png',
    aliases: ['great southern'],
  },
  { key: 'green_dot', name: 'Green Dot', logo: 'green-dot.png' },
  { key: 'halifax', name: 'Halifax', logo: 'halifax.png' },
  { key: 'handelsbanken', name: 'Handelsbanken', logo: 'handelsbanken.png' },
  { key: 'hdfc', name: 'HDFC Bank', logo: 'hdfc.png', aliases: ['hdfc'] },
  { key: 'heritage', name: 'Heritage Bank', logo: 'heritage.png' },
  { key: 'hsa_bank', name: 'HSA Bank', logo: 'hsa-bank.png' },
  { key: 'hsbc', name: 'HSBC', logo: 'hsbc.png' },
  { key: 'huntington', name: 'Huntington', logo: 'huntington.png', aliases: ['huntington bank'] },
  { key: 'ibc', name: 'IBC Bank', logo: 'ibc.png', aliases: ['international bank of commerce'] },
  { key: 'icici', name: 'ICICI Bank', logo: 'icici.png', aliases: ['icici'] },
  { key: 'ifast', name: 'iFAST Global Bank', logo: 'ifast.png', aliases: ['ifast'] },
  { key: 'ing', name: 'ING', logo: 'ing.png', aliases: ['ing bank', 'ing direct'] },
  { key: 'kbc', name: 'KBC', logo: 'kbc.png', aliases: ['kbc bank'] },
  { key: 'keybank', name: 'KeyBank', logo: 'keybank.png', aliases: ['key bank'] },
  { key: 'kroo', name: 'Kroo', logo: 'kroo.png', aliases: ['kroo bank'] },
  { key: 'laurentian', name: 'Laurentian Bank', logo: 'laurentian.png', aliases: ['laurentian'] },
  { key: 'lloyds', name: 'Lloyds Bank', logo: 'lloyds.png', aliases: ['lloyds'] },
  {
    key: 'm_and_t',
    name: 'M&T Bank',
    logo: 'm-and-t.png',
    aliases: ['m&t', 'm and t', 'manufacturers and traders'],
  },
  {
    key: 'marcus',
    name: 'Marcus by Goldman Sachs',
    logo: 'marcus.png',
    aliases: ['marcus', 'goldman sachs'],
  },
  { key: 'merrick', name: 'Merrick Bank', logo: 'merrick.png', aliases: ['merrick'] },
  { key: 'metro_bank', name: 'Metro Bank', logo: 'metro-bank.png', aliases: ['metrobank'] },
  { key: 'monzo', name: 'Monzo', logo: 'monzo.png', aliases: ['monzo bank'] },
  { key: 'n26', name: 'N26', logo: 'n26.png', aliases: ['number26'] },
  { key: 'nab', name: 'NAB', logo: 'nab.png', aliases: ['national australia bank'] },
  {
    key: 'nationwide',
    name: 'Nationwide',
    logo: 'nationwide.png',
    aliases: ['nationwide building society'],
  },
  { key: 'natwest', name: 'NatWest', logo: 'natwest.png', aliases: ['national westminster'] },
  {
    key: 'navy_federal',
    name: 'Navy Federal Credit Union',
    logo: 'navy-federal.png',
    aliases: ['navy federal', 'nfcu'],
  },
  { key: 'ncba', name: 'NCBA Bank', logo: 'ncba.png', aliases: ['ncba'] },
] as const satisfies readonly BankEntry[];
