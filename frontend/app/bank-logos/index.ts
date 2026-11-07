export type BankLogoKey =
  | 'kaspi'
  | 'bereke'
  | 'hapoalim'
  | 'absa'
  | 'ally'
  | 'anz'
  | 'associated'
  | 'atb'
  | 'axis'
  | 'banco_do_brasil'
  | 'bank_of_china'
  | 'bank_of_scotland'
  | 'barclays'
  | 'becu'
  | 'bendigo'
  | 'bmo'
  | 'bnp_paribas'
  | 'boq'
  | 'bpi'
  | 'capital_one'
  | 'capitec'
  | 'cash_app'
  | 'schwab'
  | 'chase'
  | 'chime'
  | 'cibc'
  | 'citi'
  | 'citizens'
  | 'coast_capital'
  | 'comerica'
  | 'commbank'
  | 'commerce_bank'
  | 'commercial_bank'
  | 'credit_agricole'
  | 'credit_one'
  | 'dcu'
  | 'other';

export type ResolvedBankLogo = {
  key: BankLogoKey;
  src: string;
  displayName: string;
};

const LOGO_SRC_BY_KEY: Record<BankLogoKey, string> = {
  kaspi: '/images/bank-logo/kaspi.png',
  bereke: '/images/bank-logo/bereke-bank.png',
  // No logo of their own yet.
  hapoalim: '/images/bank-logo/bank.png',
  ally: '/images/bank-logo/bank.png',
  other: '/images/bank-logo/bank.png',
  absa: '/images/bank-logo/absa.png',
  anz: '/images/bank-logo/anz.png',
  associated: '/images/bank-logo/associated.png',
  atb: '/images/bank-logo/atb.png',
  axis: '/images/bank-logo/axis.png',
  banco_do_brasil: '/images/bank-logo/banco-do-brasil.png',
  bank_of_china: '/images/bank-logo/bank-of-china.png',
  bank_of_scotland: '/images/bank-logo/bank-of-scotland.png',
  barclays: '/images/bank-logo/barclays.png',
  becu: '/images/bank-logo/becu.png',
  bendigo: '/images/bank-logo/bendigo.png',
  bmo: '/images/bank-logo/bmo.png',
  bnp_paribas: '/images/bank-logo/bnp-paribas.png',
  boq: '/images/bank-logo/boq.png',
  bpi: '/images/bank-logo/bpi.png',
  capital_one: '/images/bank-logo/capital-one.png',
  capitec: '/images/bank-logo/capitec.png',
  cash_app: '/images/bank-logo/cash-app.png',
  schwab: '/images/bank-logo/schwab.png',
  chase: '/images/bank-logo/chase.png',
  chime: '/images/bank-logo/chime.png',
  cibc: '/images/bank-logo/cibc.png',
  citi: '/images/bank-logo/citi.png',
  citizens: '/images/bank-logo/citizens.png',
  coast_capital: '/images/bank-logo/coast-capital.png',
  comerica: '/images/bank-logo/comerica.png',
  commbank: '/images/bank-logo/commbank.png',
  commerce_bank: '/images/bank-logo/commerce-bank.png',
  commercial_bank: '/images/bank-logo/commercial-bank.png',
  credit_agricole: '/images/bank-logo/credit-agricole.png',
  credit_one: '/images/bank-logo/credit-one.png',
  dcu: '/images/bank-logo/dcu.png',
};

const DISPLAY_NAME_BY_KEY: Record<BankLogoKey, string> = {
  kaspi: 'Kaspi',
  bereke: 'Bereke',
  hapoalim: 'Bank Hapoalim',
  absa: 'Absa Bank',
  ally: 'Ally Bank',
  anz: 'ANZ',
  associated: 'Associated Bank',
  atb: 'ATB Financial',
  axis: 'Axis Bank',
  banco_do_brasil: 'Banco do Brasil',
  bank_of_china: 'Bank of China (Hong Kong)',
  bank_of_scotland: 'Bank of Scotland',
  barclays: 'Barclays',
  becu: 'BECU',
  bendigo: 'Bendigo Bank',
  bmo: 'BMO',
  bnp_paribas: 'BNP Paribas',
  boq: 'BOQ',
  bpi: 'BPI',
  capital_one: 'Capital One',
  capitec: 'Capitec',
  cash_app: 'Cash App',
  schwab: 'Charles Schwab',
  chase: 'Chase',
  chime: 'Chime',
  cibc: 'CIBC',
  citi: 'Citi',
  citizens: 'Citizens',
  coast_capital: 'Coast Capital',
  comerica: 'Comerica',
  commbank: 'CommBank',
  commerce_bank: 'Commerce Bank',
  commercial_bank: 'Commercial Bank',
  credit_agricole: 'Crédit Agricole',
  credit_one: 'Credit One',
  dcu: 'DCU',
  other: 'Bank',
};

const normalize = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[\u00A0\s]+/g, ' ')
    .replace(/[._-]+/g, ' ')
    .replace(/[()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const resolveKeyFromName = (bankName: string): BankLogoKey => {
  const n = normalize(bankName);

  // Backend enum values
  if (n === 'kaspi' || n.includes('kaspi')) {
    return 'kaspi';
  }
  if (n === 'bereke new' || n === 'bereke old' || n.includes('bereke')) {
    return 'bereke';
  }
  if (n.includes('hapoalim')) {
    return 'hapoalim';
  }
  if (n === 'absa' || n.startsWith('absa ')) {
    return 'absa';
  }
  if (n === 'ally' || n.startsWith('ally bank')) {
    return 'ally';
  }
  if (n === 'anz' || n.startsWith('anz ')) {
    return 'anz';
  }
  if (n === 'associated' || n.startsWith('associated bank')) {
    return 'associated';
  }
  if (n === 'atb' || n.startsWith('atb ')) {
    return 'atb';
  }
  if (n === 'axis' || n.startsWith('axis bank')) {
    return 'axis';
  }
  if (n === 'banco_do_brasil' || n.startsWith('banco do brasil')) {
    return 'banco_do_brasil';
  }
  if (n === 'bank_of_china' || n.startsWith('bank of china')) {
    return 'bank_of_china';
  }
  if (n === 'bank_of_scotland' || n.startsWith('bank of scotland')) {
    return 'bank_of_scotland';
  }
  if (n.startsWith('barclays')) {
    return 'barclays';
  }
  if (n === 'becu' || n.startsWith('becu ')) {
    return 'becu';
  }
  if (n === 'bendigo' || n.startsWith('bendigo ')) {
    return 'bendigo';
  }
  if (n === 'bmo' || n.startsWith('bmo ')) {
    return 'bmo';
  }
  if (n === 'bnp paribas' || n.startsWith('bnp paribas ') || n === 'bnp_paribas') {
    return 'bnp_paribas';
  }
  if (n === 'boq' || n.startsWith('boq ') || n === 'bank of queensland') {
    return 'boq';
  }
  if (n === 'bpi' || n.startsWith('bpi ') || n === 'bank of the philippine islands') {
    return 'bpi';
  }
  if (n === 'capital one' || n.startsWith('capital one ') || n === 'capital_one') {
    return 'capital_one';
  }
  if (n === 'capitec' || n.startsWith('capitec ') || n === 'capitec bank') {
    return 'capitec';
  }
  if (n === 'cash app' || n.startsWith('cash app ') || n === 'cash_app') {
    return 'cash_app';
  }
  if (n === 'schwab' || n.startsWith('charles schwab') || n.startsWith('schwab ')) {
    return 'schwab';
  }
  if (n === 'chase' || n.startsWith('chase ') || n.startsWith('jpmorgan chase')) {
    return 'chase';
  }
  if (n === 'chime' || n.startsWith('chime ')) {
    return 'chime';
  }
  if (n === 'cibc' || n.startsWith('cibc ')) {
    return 'cibc';
  }
  if (n === 'citizens' || n.startsWith('citizens ')) {
    return 'citizens';
  }
  if (n === 'coast_capital' || n.startsWith('coast capital')) {
    return 'coast_capital';
  }
  if (n === 'comerica' || n.startsWith('comerica ')) {
    return 'comerica';
  }
  if (n === 'commbank' || n.startsWith('commonwealth bank')) {
    return 'commbank';
  }
  if (n === 'commerce_bank' || n.startsWith('commerce bank')) {
    return 'commerce_bank';
  }
  if (n === 'commercial_bank' || n.startsWith('commercial bank')) {
    return 'commercial_bank';
  }
  if (
    n === 'credit_agricole' ||
    n.startsWith('credit agricole') ||
    n.startsWith('crédit agricole')
  ) {
    return 'credit_agricole';
  }
  if (n === 'credit_one' || n.startsWith('credit one')) {
    return 'credit_one';
  }
  if (n === 'dcu' || n.startsWith('digital federal credit union')) {
    return 'dcu';
  }
  if (n === 'citi' || n.startsWith('citi ') || n.startsWith('citibank')) {
    return 'citi';
  }
  if (n === 'other') {
    return 'other';
  }

  // Common aliases / noisy variants
  if (n.includes('kaspi bank')) {
    return 'kaspi';
  }
  if (n.includes('bereke bank')) {
    return 'bereke';
  }

  return 'other';
};

export const resolveBankLogo = (bankName?: string | null): ResolvedBankLogo => {
  const key = bankName ? resolveKeyFromName(bankName) : 'other';
  return {
    key,
    src: LOGO_SRC_BY_KEY[key],
    displayName: DISPLAY_NAME_BY_KEY[key],
  };
};

/** Every bank with a parser of its own, by name. */
export const listSupportedBanks = (): ResolvedBankLogo[] =>
  (Object.keys(DISPLAY_NAME_BY_KEY) as BankLogoKey[])
    .filter(key => key !== 'other')
    .map(key => ({ key, src: LOGO_SRC_BY_KEY[key], displayName: DISPLAY_NAME_BY_KEY[key] }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
