import {
  PENDING_MAX_AGE_DAYS,
  planPendingRows,
  type StoredPendingRow,
} from '../../../../src/modules/bank-sync/bank-sync-pending';
import type { BankSyncTransaction } from '../../../../src/modules/bank-sync/bank-sync-provider.interface';
import { remoteRow } from './support';

const now = new Date('2026-09-30T12:00:00Z');
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
const stored = (overrides: Partial<StoredPendingRow> = {}): StoredPendingRow => ({
  id: 'tx-pending',
  documentNumber: 'ACT-1:AUTH-1',
  transactionDate: '2026-09-28',
  ...overrides,
});

/** Two rows are "the same purchase" here when their amounts match: the stand-in for the tolerant rules. */
const sameAmount = (amounts: Record<string, number>) => (row: BankSyncTransaction, candidate: StoredPendingRow) =>
  amounts[candidate.id] === row.amount;

const plan = (
  rows: BankSyncTransaction[],
  storedRows: StoredPendingRow[],
  isSame: (row: BankSyncTransaction, candidate: StoredPendingRow) => boolean = () => false,
  known: string[] = [],
) => planPendingRows({ accountId: 'ACT-1', stored: storedRows, rows, known: new Set(known), now, isSame });

describe('planPendingRows', () => {
  it('imports a new pending row like any new row', () => {
    const row = remoteRow({ id: 'AUTH-1', pending: true, posted: daysAgo(1) });

    expect(plan([row], [])).toEqual({ post: [], refresh: [], remove: [], incoming: [row] });
  });

  it('posts the pending row the booked version names by the provider id', () => {
    const booked = remoteRow({ id: 'AUTH-1', pending: false, posted: daysAgo(1) });

    const result = plan([booked], [stored()]);

    expect(result.post).toEqual([{ storedId: 'tx-pending', row: booked }]);
    expect(result.incoming).toEqual([]);
  });

  it('falls back to the tolerant comparison when the bank renumbered the booked row', () => {
    const booked = remoteRow({ id: 'BOOKED-9', amount: -15, posted: daysAgo(1) });

    const result = plan([booked], [stored()], sameAmount({ 'tx-pending': -15 }));

    expect(result.post).toEqual([{ storedId: 'tx-pending', row: booked }]);
    expect(result.incoming).toEqual([]);
  });

  it('never takes a pending row the provider still lists as pending for a look-alike booked row', () => {
    const stillPending = remoteRow({ id: 'AUTH-1', amount: -15, pending: true, posted: daysAgo(1) });
    const otherPurchase = remoteRow({ id: 'BOOKED-9', amount: -15, posted: daysAgo(1) });

    // The booked row comes first, so only the "still listed" guard can keep it off the hold.
    const result = plan(
      [otherPurchase, stillPending],
      [stored()],
      sameAmount({ 'tx-pending': -15 }),
    );

    expect(result.post).toEqual([]);
    expect(result.refresh).toEqual([{ storedId: 'tx-pending', row: stillPending }]);
    expect(result.incoming).toEqual([otherPurchase]);
  });

  it('never takes a pending row for a look-alike booked row the workspace already holds', () => {
    // The provider lists booked rows on every pull; this one was imported before,
    // and the hold beside it was reversed: it lapses on its own, it does not book.
    const alreadyStored = remoteRow({ id: 'BOOK-1', amount: -15, posted: daysAgo(1) });

    const result = plan(
      [alreadyStored],
      [stored()],
      sameAmount({ 'tx-pending': -15 }),
      ['ACT-1:BOOK-1'],
    );

    expect(result.post).toEqual([]);
    expect(result.incoming).toEqual([alreadyStored]);
  });

  it('lets one pending row stand for one booked row only', () => {
    const first = remoteRow({ id: 'BOOKED-1', amount: -15, posted: daysAgo(1) });
    const second = remoteRow({ id: 'BOOKED-2', amount: -15, posted: daysAgo(1) });

    const result = plan([first, second], [stored()], sameAmount({ 'tx-pending': -15 }));

    expect(result.post).toEqual([{ storedId: 'tx-pending', row: first }]);
    expect(result.incoming).toEqual([second]);
  });

  it('never matches a new pending row to a stored one by resemblance', () => {
    const anotherHold = remoteRow({ id: 'AUTH-2', amount: -15, pending: true, posted: daysAgo(1) });

    const result = plan([anotherHold], [stored()], () => true);

    expect(result.post).toEqual([]);
    expect(result.incoming).toEqual([anotherHold]);
  });

  it('keeps a recent pending row the bank stopped listing, and removes one older than the limit', () => {
    const recent = stored({ id: 'recent', documentNumber: 'ACT-1:A', transactionDate: daysAgo(3) });
    const lapsed = stored({
      id: 'lapsed',
      documentNumber: 'ACT-1:B',
      transactionDate: daysAgo(PENDING_MAX_AGE_DAYS + 1),
    });

    expect(plan([], [recent, lapsed]).remove).toEqual(['lapsed']);
  });

  it('removes a pending row past the limit even while the bank still lists it, and does not import it again', () => {
    const old = daysAgo(PENDING_MAX_AGE_DAYS + 2);
    const listed = remoteRow({ id: 'AUTH-1', pending: true, posted: old });
    const unknown = remoteRow({ id: 'AUTH-7', pending: true, posted: old });

    const result = plan([listed, unknown], [stored({ transactionDate: old })]);

    expect(result.remove).toEqual(['tx-pending']);
    expect(result.refresh).toEqual([]);
    expect(result.incoming).toEqual([]);
  });

  it('still posts a booked row whose day is older than the limit: only pending rows lapse', () => {
    const booked = remoteRow({ id: 'AUTH-1', posted: daysAgo(PENDING_MAX_AGE_DAYS + 5) });

    const result = plan([booked], [stored({ transactionDate: daysAgo(PENDING_MAX_AGE_DAYS + 5) })]);

    expect(result.post).toEqual([{ storedId: 'tx-pending', row: booked }]);
    expect(result.remove).toEqual([]);
  });
});
