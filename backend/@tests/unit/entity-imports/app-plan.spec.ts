import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { NotFoundException } from '@nestjs/common';
import { freshTransactions } from '../../../src/modules/entity-imports/apps/app-import-dedupe';
import { type AppTxn, appTxn } from '../../../src/modules/entity-imports/apps/app-model';
import { parseAppFile } from '../../../src/modules/entity-imports/apps/app-parse';
import {
  type ExistingWallet,
  knownAccountKeys,
  planAccounts,
} from '../../../src/modules/entity-imports/apps/app-plan-accounts';
import { planBudgets } from '../../../src/modules/entity-imports/apps/app-plan-budgets';
import {
  categoryUses,
  planCategories,
} from '../../../src/modules/entity-imports/apps/app-plan-categories';
import { planTransactions } from '../../../src/modules/entity-imports/apps/app-plan-transactions';
import { nameKey } from '../../../src/modules/entity-imports/helpers/import-values';

const WORKSPACE_ID = '11111111-1111-4111-8111-111111111111';
const FIXTURES = path.join(__dirname, '../../fixtures/app-exports');
const parsed = (name: string) =>
  parseAppFile(
    { fileName: name, buffer: new Uint8Array(readFileSync(path.join(FIXTURES, name))) },
    new Map(),
  );

/** Plans the rows the way the service does, with every account still to be created. */
const plan = (txns: AppTxn[], wallets: ExistingWallet[] = []) => {
  const accounts = planAccounts(txns, wallets, new Map(), { currency: 'USD', accounts: {} });
  const names = new Map([...accounts.values()].map(account => [account.key, account.name]));
  const ref = (key: string) => accounts.get(key)?.walletId ?? `new:${key}`;
  return {
    accounts,
    ref,
    ...planTransactions(txns, knownAccountKeys(txns, wallets), names, ref),
  };
};

const row = (fields: Partial<AppTxn> & Pick<AppTxn, 'account' | 'amount'>): AppTxn =>
  appTxn({ fileName: 'f.csv', row: 1, date: '2026-01-10', payee: 'Shop', memo: '', ...fields });

describe('transfers', () => {
  it('books both YNAB legs as one pair, not two expenses and not twice', () => {
    const { txns, transfers } = plan(parsed('ynab-register.csv').txns);
    const savings = txns.filter(txn => txn.date === '2026-01-18');
    expect(savings).toHaveLength(2);
    expect(savings[0].pairKey).toBe(savings[1].pairKey);
    expect(savings.map(txn => [txn.accountKey, txn.amount])).toEqual([
      ['checking', -200],
      ['savings', 200],
    ]);
    expect(savings.every(txn => txn.categoryKey === null && !txn.synthetic)).toBe(true);
    // Each leg is paid to the other account, not to YNAB's "Transfer : …" payee.
    expect(savings.map(txn => txn.payee)).toEqual(['Savings', 'Checking']);
    // Savings, Brokerage (one side only) and the card payment.
    expect(transfers).toBe(3);
  });

  it('writes the missing leg of a transfer whose other account the file does not have', () => {
    const { txns, accounts } = plan(parsed('ynab-register.csv').txns);
    const legs = txns.filter(txn => txn.date === '2026-01-19');
    expect(legs.map(txn => [txn.accountKey, txn.amount, txn.synthetic])).toEqual([
      ['checking', -50, false],
      ['brokerage', 50, true],
    ]);
    expect(accounts.get('brokerage')).toMatchObject({ name: 'Brokerage', status: 'created' });
  });

  it('pairs Actual legs by the account names their payees carry', () => {
    const { txns } = plan(parsed('actual-export.csv').txns);
    const legs = txns.filter(txn => txn.pairKey);
    expect(legs.map(txn => [txn.accountKey, txn.amount])).toEqual([
      ['everyday account', -150],
      ['rainy day', 150],
    ]);
  });

  it('gives one Firefly transfer row both legs', () => {
    const { txns } = plan(parsed('firefly-export.csv').txns);
    const legs = txns.filter(txn => txn.pairKey);
    expect(legs.map(txn => [txn.accountKey, txn.amount, txn.payee])).toEqual([
      ['main account', -400, 'Savings account'],
      ['savings account', 400, 'Main account'],
    ]);
  });

  it('keeps an Actual payee that names no account an ordinary payee', () => {
    const { txns } = plan([row({ account: 'Wallet', amount: -5, payee: 'Bean Cafe', payeeMayBeAccount: true })]);
    expect(txns[0]).toMatchObject({ pairKey: null, payee: 'Bean Cafe' });
  });

  it('pairs a leg on an existing account by the account name', () => {
    const wallets = [{ id: 'w-1', name: 'Rainy Day', currency: 'EUR', ownerMemberId: null }];
    const { txns, accounts } = plan(
      [row({ account: 'Everyday', amount: -20, payee: 'Rainy Day', payeeMayBeAccount: true })],
      wallets,
    );
    expect(accounts.get('rainy day')).toMatchObject({ status: 'matched', walletId: 'w-1', currency: 'EUR' });
    expect(txns.map(txn => [txn.accountKey, txn.amount, txn.synthetic])).toEqual([
      ['everyday', -20, false],
      ['rainy day', 20, true],
    ]);
  });
});

describe('identities', () => {
  it('tells two equal rows of one day apart, and reads the same file to the same identities', () => {
    const first = plan(parsed('ynab-register.csv').txns).txns;
    const coffees = first.filter(txn => txn.payee === 'Bean Cafe');
    expect(coffees).toHaveLength(2);
    expect(coffees[0].identity).not.toBe(coffees[1].identity);
    const again = plan(parsed('ynab-register.csv').txns).txns;
    expect(again.map(txn => txn.identity)).toEqual(first.map(txn => txn.identity));
  });

  it('gives a one-sided transfer leg the identity the other file will give it', () => {
    // Actual exports one account at a time: the leg written for the first file
    // must be the row the second file brings.
    const out = row({ account: 'A', amount: -30, payee: 'B', payeeMayBeAccount: true });
    const into = row({ account: 'B', amount: 30, payee: 'A', payeeMayBeAccount: true });
    const wallets = [
      { id: 'wa', name: 'A', currency: 'USD', ownerMemberId: null },
      { id: 'wb', name: 'B', currency: 'USD', ownerMemberId: null },
    ];
    const fromA = plan([out], wallets).txns.find(txn => txn.accountKey === 'b');
    const fromB = plan([into], wallets).txns.find(txn => txn.accountKey === 'b');
    expect(fromA?.synthetic).toBe(true);
    expect(fromA?.identity).toBe(fromB?.identity);
  });

  it("remembers the identity a leg had when its payee's account was not known yet", () => {
    // Actual's account A read on its own: B was no account then, the row an ordinary one.
    const daily = row({ account: 'A', amount: -30, payee: 'B', memo: 'Top up', payeeMayBeAccount: true });
    const walletA = { id: 'wa', name: 'A', currency: 'USD', ownerMemberId: null };
    const before = plan([daily], [walletA]).txns;
    expect(before).toMatchObject([{ pairKey: null, former: null }]);
    // B became an account since: the same row is now a transfer leg.
    const walletB = { id: 'wb', name: 'B', currency: 'USD', ownerMemberId: null };
    const after = plan([daily], [walletA, walletB]).txns;
    const leg = after.find(txn => txn.accountKey === 'a');
    expect(leg?.pairKey).toBeTruthy();
    expect(leg?.former).toBe(before[0].identity);
    // The leg written for B, and a YNAB leg (always a transfer), had no earlier form.
    expect(after.find(txn => txn.accountKey === 'b')?.former).toBeNull();
    const ynab = plan(parsed('ynab-register.csv').txns).txns.filter(txn => txn.pairKey);
    expect(ynab.every(txn => txn.former === null)).toBe(true);
  });
});

describe('splits', () => {
  it('turns a split whose other parts were unreadable into an ordinary row', () => {
    const { txns } = plan([row({ account: 'A', amount: -3, splitKey: 'f.csv#1' })]);
    expect(txns[0].splitKey).toBeNull();
  });
});

describe('accounts', () => {
  const txns = [
    row({ account: 'Checking', amount: 100, opening: true }),
    row({ account: 'Checking', amount: -5 }),
    row({ account: 'Savings', amount: 40, opening: true }),
  ];

  it('opens a new account at its starting balance and leaves an existing one alone', () => {
    const wallets = [{ id: 'w-s', name: 'savings', currency: 'GBP', ownerMemberId: 'm-1' }];
    const accounts = planAccounts(txns, wallets, new Map(), { currency: 'usd', accounts: {} });
    expect(accounts.get('checking')).toMatchObject({ status: 'created', opening: 100, currency: 'USD' });
    expect(accounts.get('savings')).toMatchObject({
      status: 'matched',
      walletId: 'w-s',
      ownerMemberId: 'm-1',
      opening: 0,
      openingsSkipped: 1,
    });
  });

  it('opens an account an earlier import created at zero from its own export', () => {
    // Created as the other side of a transfer; the opening came with its own file later.
    const wallets = [
      { id: 'w-s', name: 'Savings', currency: 'USD', ownerMemberId: null, takesOpening: true },
      { id: 'w-c', name: 'Checking', currency: 'USD', ownerMemberId: null, takesOpening: false },
    ];
    const accounts = planAccounts(txns, wallets, new Map(), { currency: 'USD', accounts: {} });
    expect(accounts.get('savings')).toMatchObject({
      status: 'matched',
      takesOpening: true,
      opening: 40,
      openingsSkipped: 0,
    });
    expect(accounts.get('checking')).toMatchObject({ opening: 0, openingsSkipped: 1 });
  });

  it('follows the choice: another account, or a new one despite a name match', () => {
    const wallets = [
      { id: 'w-s', name: 'Savings', currency: 'USD', ownerMemberId: null },
      { id: 'w-x', name: 'Old Checking', currency: 'USD', ownerMemberId: null },
    ];
    const accounts = planAccounts(txns, wallets, new Map(), {
      currency: 'USD',
      accounts: { Checking: 'w-x', Savings: null },
    });
    expect(accounts.get('checking')).toMatchObject({ status: 'matched', walletId: 'w-x' });
    expect(accounts.get('savings')).toMatchObject({ status: 'created', walletId: null });
  });

  it('refuses an account id the workspace does not have', () => {
    expect(() =>
      planAccounts(txns, [], new Map(), { currency: 'USD', accounts: { Checking: 'w-other' } }),
    ).toThrow(NotFoundException);
  });
});

describe('categories', () => {
  it('matches under the same group first, then by name and type, and creates the rest', () => {
    const uses = categoryUses(
      [
        { group: 'Everyday', category: 'Groceries', amount: -5 },
        { group: 'Fun', category: 'Books', amount: -5 },
        { group: 'Home', category: 'Rent', amount: -5 },
        { group: null, category: 'Salary', amount: 900 },
      ],
      [],
    );
    const existing = [
      { id: 'g-every', name: 'Everyday', parentId: null, type: 'expense' as const },
      { id: 'c-groc', name: 'groceries', parentId: 'g-every', type: 'expense' as const },
      { id: 'c-books', name: 'Books', parentId: null, type: 'expense' as const },
    ];
    const { categories, groups } = planCategories(uses, existing);
    const get = (group: string | null, name: string) =>
      categories.get(`${nameKey(group ?? '')}|${nameKey(name)}`);
    expect(get('Everyday', 'Groceries')).toMatchObject({ status: 'matched', id: 'c-groc' });
    expect(get('Fun', 'Books')).toMatchObject({ status: 'matched', id: 'c-books' });
    expect(get('Home', 'Rent')).toMatchObject({ status: 'created', group: 'Home' });
    expect(get(null, 'Salary')).toMatchObject({ status: 'created', type: 'income' });
    expect([...groups.values()].map(group => [group.name, group.status])).toEqual([['Home', 'created']]);
  });

  it('creates one category for one name used under two groups', () => {
    const uses = categoryUses(
      [
        { group: 'Home', category: 'Misc', amount: -1 },
        { group: 'Fun', category: 'Misc', amount: -1 },
      ],
      [],
    );
    const { categories } = planCategories(uses, []);
    expect(new Set(categories.values()).size).toBe(1);
  });

  it('does not create a group named like its own category', () => {
    const uses = categoryUses([{ group: 'Food', category: 'Food', amount: -1 }], []);
    const { categories, groups } = planCategories(uses, []);
    expect(groups.size).toBe(0);
    expect([...categories.values()][0]).toMatchObject({ group: null, name: 'Food' });
  });

  it('does not create a group named like an existing subcategory', () => {
    const existing = [
      { id: 'p', name: 'Living', parentId: null, type: 'expense' as const },
      { id: 'c', name: 'Home', parentId: 'p', type: 'expense' as const },
    ];
    const uses = categoryUses([{ group: 'Home', category: 'Rent', amount: -1 }], []);
    const { categories, groups } = planCategories(uses, existing);
    expect(groups.size).toBe(0);
    expect([...categories.values()][0]).toMatchObject({ group: null, status: 'created' });
  });
});

describe('budgets', () => {
  const rows = parsed('ynab-plan.csv').budgets;

  it("takes the latest begun month's assigned amounts as the monthly limits", () => {
    expect(planBudgets(rows, '2026-11-09')).toEqual({
      month: '2026-10',
      budgets: [
        { categoryKey: 'everyday|groceries', name: 'Groceries', limit: 320 },
        { categoryKey: 'home|rent', name: 'Rent', limit: 1200 },
      ],
      skipped: 1,
    });
  });

  it('uses the latest month when the plan holds only months to come', () => {
    expect(planBudgets(rows, '2026-01-01').month).toBe('2026-12');
  });
});

describe('dedupe', () => {
  const manager = (known: (prints: string[]) => string[]) =>
    ({
      getRepository: () => ({
        find: vi.fn(async ({ where }: { where: { fingerprint: { value: string[] } } }) =>
          known(where.fingerprint.value).map(fingerprint => ({ fingerprint })),
        ),
      }),
    }) as never;

  it('leaves a transfer whole when either leg is already booked', async () => {
    const { txns, accounts, ref } = plan(parsed('ynab-register.csv').txns);
    const first = await freshTransactions(manager(() => []), WORKSPACE_ID, txns, accounts, ref);
    const savingsIn = first.fresh.find(txn => txn.accountKey === 'savings' && txn.pairKey);
    const second = await freshTransactions(
      manager(prints => prints.filter(print => print === savingsIn?.fingerprint)),
      WORKSPACE_ID,
      txns,
      accounts,
      ref,
    );
    expect(second.duplicates).toBe(2);
    expect(second.fresh.some(txn => txn.pairKey === savingsIn?.pairKey)).toBe(false);
  });

  it('leaves a split whole when any part is already booked', async () => {
    const { txns, accounts, ref } = plan(parsed('ynab-register.csv').txns);
    const first = await freshTransactions(manager(() => []), WORKSPACE_ID, txns, accounts, ref);
    const part = first.fresh.find(txn => txn.splitKey);
    const second = await freshTransactions(
      manager(prints => prints.filter(print => print === part?.fingerprint)),
      WORKSPACE_ID,
      txns,
      accounts,
      ref,
    );
    expect(second.duplicates).toBe(2);
    expect(second.fresh.some(txn => txn.splitKey === part?.splitKey)).toBe(false);
  });
});
