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
  absa: '/images/bank-logo/bank.png',
  ally: '/images/bank-logo/bank.png',
  anz: '/images/bank-logo/bank.png',
  associated: '/images/bank-logo/bank.png',
  atb: '/images/bank-logo/bank.png',
  axis: '/images/bank-logo/bank.png',
  banco_do_brasil: '/images/bank-logo/bank.png',
  bank_of_china: '/images/bank-logo/bank.png',
  bank_of_scotland: '/images/bank-logo/bank.png',
  barclays: '/images/bank-logo/bank.png',
  becu: '/images/bank-logo/bank.png',
  bendigo: '/images/bank-logo/bank.png',
  bmo: '/images/bank-logo/bank.png',
  bnp_paribas: '/images/bank-logo/bank.png',
  boq: '/images/bank-logo/bank.png',
  bpi: '/images/bank-logo/bank.png',
  capital_one: '/images/bank-logo/bank.png',
  capitec: '/images/bank-logo/bank.png',
  cash_app: '/images/bank-logo/bank.png',
  schwab: '/images/bank-logo/bank.png',
  chase: '/images/bank-logo/bank.png',
  chime: '/images/bank-logo/bank.png',
  cibc: '/images/bank-logo/bank.png',
  citi: '/images/bank-logo/bank.png',
  citizens: '/images/bank-logo/bank.png',
  other: '/images/bank-logo/bank.png',
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
