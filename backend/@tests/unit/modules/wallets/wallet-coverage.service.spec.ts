import type { Repository } from 'typeorm';
import type { WalletItem } from '@/contracts';
import type { Statement } from '@/entities/statement.entity';
import { WalletCoverageService } from '@/modules/wallets/wallet-coverage.service';
import type { WalletsService } from '@/modules/wallets/wallets.service';

const WORKSPACE = 'ws-1';

type Group = {
  walletId: string | null;
  bankName: string | null;
  accountNumber: string | null;
  dataTo: string | null;
  pendingReview: string;
};

/** A query builder that records every call and answers `groups`. */
function queryOf(groups: Group[]) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const query: Record<string, unknown> = {};
  for (const method of [
    'leftJoin',
    'select',
    'addSelect',
    'where',
    'andWhere',
    'groupBy',
    'addGroupBy',
  ]) {
    query[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return query;
    };
  }
  query.getRawMany = async () => groups;
  return { query, calls };
}

function account(overrides: Partial<WalletItem>): WalletItem {
  return {
    id: 'w-everyday',
    workspaceId: WORKSPACE,
    userId: 'user-1',
    name: 'Everyday Account',
    type: 'checking',
    accountNumber: null,
    bankName: 'ACME Bank',
    currency: 'EUR',
    initialBalance: '0',
    isActive: true,
    ownerMemberId: null,
    balance: 0,
    unconvertedCurrencies: [],
    transactionCount: 0,
    pendingReviewCount: 0,
    lastActivityAt: null,
    reconciliation: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function setup(groups: Group[], accounts: WalletItem[]) {
  const { query, calls } = queryOf(groups);
  const statements = { createQueryBuilder: vi.fn(() => query) };
  const wallets = { list: vi.fn(async () => accounts) };
  const service = new WalletCoverageService(
    statements as unknown as Repository<Statement>,
    wallets as unknown as WalletsService,
  );
  return { service, calls, wallets };
}

describe('WalletCoverageService', () => {
  const mismatch = {
    statementId: 'st-1',
    date: '2026-10-31',
    statementBalance: 120,
    computedBalance: 108,
    matches: false,
  };

  it("gives each account fed by statements its latest day, balance check and rows in Review", async () => {
    const everyday = account({ pendingReviewCount: 3, reconciliation: mismatch });
    const { service, calls, wallets } = setup(
      [
        { walletId: everyday.id, bankName: 'acme', accountNumber: null, dataTo: '2026-09-30', pendingReview: '0' },
        { walletId: everyday.id, bankName: 'acme', accountNumber: 'DE00 01', dataTo: '2026-10-31', pendingReview: '1' },
      ],
      [everyday],
    );

    const { rows } = await service.coverage(WORKSPACE);

    expect(rows).toEqual([
      {
        kind: 'account',
        walletId: everyday.id,
        name: everyday.name,
        bankName: everyday.bankName,
        accountTail: null,
        dataTo: '2026-10-31',
        pendingReview: 3,
        currency: everyday.currency,
        reconciliation: mismatch,
      },
    ]);
    expect(wallets.list).toHaveBeenCalledWith(WORKSPACE);
    expect(calls).toContainEqual({
      method: 'where',
      args: ['statement.workspaceId = :workspaceId', { workspaceId: WORKSPACE }],
    });
  });

  it('leaves out an account with no statements and one that is closed', async () => {
    const cash = account({ id: 'w-cash', name: 'Cash', type: 'cash' });
    const closed = account({ id: 'w-closed', name: 'Old Account', isActive: false });
    const { service } = setup(
      [{ walletId: closed.id, bankName: 'acme', accountNumber: null, dataTo: '2026-10-31', pendingReview: '0' }],
      [cash, closed],
    );

    expect((await service.coverage(WORKSPACE)).rows).toEqual([]);
  });

  it("names an account's bank from its statements when the account names none", async () => {
    const everyday = account({ bankName: null });
    const { service } = setup(
      [{ walletId: everyday.id, bankName: 'acme', accountNumber: null, dataTo: '2026-10-31', pendingReview: '0' }],
      [everyday],
    );

    expect((await service.coverage(WORKSPACE)).rows[0].bankName).toBe('acme');
  });

  it('groups statements no account holds by bank and number, showing only the last four characters', async () => {
    const NUMBER = 'DE00 0000 0000 0000 0001';
    // The same account as another export prints it.
    const sameNumber = NUMBER.replace(/\s+/g, '').toLowerCase();
    const { service } = setup(
      [
        { walletId: null, bankName: 'acme', accountNumber: NUMBER, dataTo: '2026-09-30', pendingReview: '2' },
        { walletId: null, bankName: 'acme', accountNumber: sameNumber, dataTo: '2026-10-31', pendingReview: '1' },
        { walletId: null, bankName: 'other', accountNumber: 'Unknown', dataTo: '2026-10-15', pendingReview: '0' },
      ],
      [],
    );

    const { rows } = await service.coverage(WORKSPACE);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      kind: 'bank',
      walletId: null,
      name: null,
      bankName: 'acme',
      accountTail: NUMBER.slice(-4),
      dataTo: '2026-10-31',
      pendingReview: 3,
    });
    expect(rows[1]).toMatchObject({ bankName: 'other', accountTail: null, dataTo: '2026-10-15' });
    expect(JSON.stringify(rows)).not.toContain('DE00');
  });
});
