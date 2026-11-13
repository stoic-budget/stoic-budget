import {
  accountFields,
  takeStatementAccount,
} from '@/modules/parsing/helpers/statement-account.helper';

const account = { id: 'wallet-card', ownerMemberId: 'member-1' };

describe("a row's account on import", () => {
  it("is its statement's account, with that account's owner", () => {
    expect(accountFields(account, {})).toEqual({
      walletId: 'wallet-card',
      ownerMemberId: 'member-1',
    });
  });

  it('keeps the owner a rule named over the one of the account', () => {
    expect(accountFields(account, { ownerMemberId: null })).toEqual({
      walletId: 'wallet-card',
      ownerMemberId: null,
    });
  });

  it("is the account a rule named, which beats the statement's", () => {
    // Nothing to add: the classification already carries the rule's account and its owner.
    expect(accountFields(account, { walletId: 'wallet-cash', ownerMemberId: 'member-2' })).toEqual({});
  });

  it('is nothing for a statement of no account', () => {
    expect(accountFields(null, {})).toEqual({});
  });
});

describe("a statement's share of a file with several accounts", () => {
  const account = (accountNumber: string, warnings?: string[]) => ({
    metadata: {
      accountNumber,
      currency: 'USD',
      dateFrom: new Date('2026-09-01'),
      dateTo: new Date('2026-09-30'),
    },
    transactions: [],
    ...(warnings ? { warnings } : {}),
  });

  it("takes the warnings of its own account, not the other accounts'", () => {
    const parse = () => ({
      ...account('Everyday Account', ['about the first']),
      otherAccounts: [account('Rainy Day Savings', ['about the second'])],
    });
    const upload = { warnings: ['earlier'] };
    takeStatementAccount(parse(), { sourceAccountIndex: null }, upload);
    expect(upload.warnings).toEqual(['earlier', 'about the first']);

    const sibling: { warnings?: string[] } = {};
    takeStatementAccount(parse(), { sourceAccountIndex: 1 }, sibling);
    expect(sibling.warnings).toEqual(['about the second']);
  });
});
