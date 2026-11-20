import { BANKS } from './banks';

type Bank = (typeof BANKS)[number];

export type BankLogoKey = Bank['key'] | 'other';

export type ResolvedBankLogo = {
  key: BankLogoKey;
  src: string;
  displayName: string;
};

const LOGO_DIR = '/images/bank-logo/';

const OTHER: ResolvedBankLogo = { key: 'other', src: `${LOGO_DIR}bank.png`, displayName: 'Bank' };

const normalize = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[ \s]+/g, ' ')
    .replace(/[._-]+/g, ' ')
    .replace(/[()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const toResolved = (bank: Bank): ResolvedBankLogo => ({
  key: bank.key,
  src: `${LOGO_DIR}${bank.logo}`,
  displayName: bank.name,
});

/** A bank's names: the stored key, spaced, and its aliases. */
const namesOf = (bank: Bank): string[] => [
  normalize(bank.key),
  ...('aliases' in bank ? bank.aliases.map(normalize) : []),
];

/**
 * The bank a stored or typed-in name means: a name of the bank on its own or
 * followed by more words ("Axis Bank Ltd"), or anywhere for the few that say so.
 */
const findBank = (bankName: string): Bank | undefined => {
  const n = normalize(bankName);
  return BANKS.find(bank =>
    namesOf(bank).some(
      name =>
        n === name ||
        n.startsWith(`${name} `) ||
        ('anywhere' in bank && bank.anywhere && n.includes(name)),
    ),
  );
};

export const resolveBankLogo = (bankName?: string | null): ResolvedBankLogo => {
  const bank = bankName ? findBank(bankName) : undefined;
  return bank ? toResolved(bank) : OTHER;
};

/** Every bank with a parser of its own, by name. */
export const listSupportedBanks = (): ResolvedBankLogo[] =>
  BANKS.map(toResolved).sort((a, b) => a.displayName.localeCompare(b.displayName));
