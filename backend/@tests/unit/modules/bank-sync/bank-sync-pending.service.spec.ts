import { BankSyncPendingService } from '@/modules/bank-sync/bank-sync-pending.service';
import type { Transaction } from '@/entities';

/**
 * Posting a hold in place: the booked version is checked against the
 * workspace's rows the way an import would check it, so a purchase also
 * booked by hand or by a statement upload is not counted twice.
 */
describe('BankSyncPendingService posting a hold', () => {
  const workspaceId = 'ws-1';
  const account = { id: 'ACT-P' } as never;
  const now = new Date('2026-11-20T12:00:00Z');
  const hold = {
    id: 'hold-1',
    workspaceId,
    documentNumber: 'ACT-P:AUTH-1',
    isPending: true,
    amount: '15.00',
    currency: 'USD',
    counterpartyName: 'ACME Store - Wireless Buds',
    transactionDate: '2026-11-18',
    statement: { accountNumber: '' },
  } as unknown as Transaction;
  const booked = {
    id: 'AUTH-1',
    posted: new Date('2026-11-19T00:00:00Z'),
    amount: -15,
    description: 'ACME Store - Wireless Buds',
    pending: false,
  };

  const setUp = (twins: { statement?: string; manual?: string }) => {
    const update = vi.fn();
    const manager = {
      findOne: vi.fn(async () => (twins.statement ? { id: twins.statement } : null)),
      update,
      delete: vi.fn(),
    };
    const repository = {
      find: vi.fn(async ({ where }: { where: { isPending: boolean } }) => (where.isPending ? [hold] : [])),
      manager: { transaction: async (work: (m: typeof manager) => Promise<void>) => work(manager) },
    };
    const flagRepeats = vi.fn(async (drafts: Transaction[]) => {
      if (!twins.manual) return 0;
      drafts[0].isDuplicate = true;
      drafts[0].duplicateOfId = twins.manual;
      drafts[0].duplicateMatchType = 'manual_entry';
      return 1;
    });
    const service = new BankSyncPendingService(
      repository as never,
      { applyTolerantRules: () => ({ isMatch: false }) } as never,
      { reassess: vi.fn(async () => 0) } as never,
      { flagRepeats } as never,
    );
    const settle = () => service.settle(workspaceId, account, [booked], 'USD', now);
    const written = () => update.mock.calls[0][2] as Partial<Transaction>;
    return { settle, written, flagRepeats };
  };

  it('flags the booked hold a duplicate of a row booked by hand for the same money', async () => {
    const { settle, written, flagRepeats } = setUp({ manual: 'manual-1' });
    await settle();
    expect(flagRepeats).toHaveBeenCalledWith(
      [expect.objectContaining({ debit: 15, credit: null, currency: 'USD' })],
      workspaceId,
    );
    expect(written()).toMatchObject({
      isPending: false,
      isDuplicate: true,
      duplicateOfId: 'manual-1',
      duplicateMatchType: 'manual_entry',
    });
  });

  it('flags it a duplicate of a statement row with its fingerprint, without asking about hand-booked rows', async () => {
    const { settle, written, flagRepeats } = setUp({ statement: 'statement-row-1' });
    await settle();
    expect(flagRepeats).not.toHaveBeenCalled();
    expect(written()).toMatchObject({ isDuplicate: true, duplicateOfId: 'statement-row-1' });
  });

  it('books it as an ordinary row when nothing repeats it', async () => {
    const { settle, written } = setUp({});
    await settle();
    expect(written()).toMatchObject({ isPending: false });
    expect(written()).not.toHaveProperty('isDuplicate');
  });
});
