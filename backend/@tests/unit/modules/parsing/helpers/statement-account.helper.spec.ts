import { accountFields } from '@/modules/parsing/helpers/statement-account.helper';

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
