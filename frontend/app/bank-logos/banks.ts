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
] as const satisfies readonly BankEntry[];
