import { StatementStatus } from '@/entities/statement.entity';
import { StatementRowsService } from '@/modules/statements/statement-rows.service';

vi.mock('@/modules/statements/statement-access', () => ({
  ensureCanModifyStatement: vi.fn(async () => undefined),
}));

/** A statement with no balances, held because the parse could not read most rows. */
const heldStatement = (droppedRows: number) => ({
  id: 'st-1',
  workspaceId: 'ws-1',
  userId: 'u-1',
  status: StatementStatus.NEEDS_REVIEW,
  balanceStart: null,
  balanceEnd: null,
  parsingDetails: {
    validation: { passed: false, reasonCodes: ['rows_dropped'] },
    droppedSamples: Array.from({ length: droppedRows }, (_, index) => ({
      reason: 'unreadable date',
      transaction: { description: `Row ${index}` },
    })),
  },
});

const service = (statement: ReturnType<typeof heldStatement>, rowCount: number, duplicates = 0) => {
  const statements = { update: vi.fn(async () => undefined) };
  const rows = Array.from({ length: rowCount }, (_, index) => ({
    id: `tx-${index}`,
    debit: '10.00',
    credit: null,
    currency: 'EUR',
    isDuplicate: index < duplicates,
  }));
  return {
    statements,
    rows: new StatementRowsService(
      statements as never,
      { find: vi.fn(async () => rows) } as never,
      {} as never,
      { findOne: vi.fn(async () => statement) } as never,
    ),
  };
};

describe('StatementRowsService recheck', () => {
  it('keeps a statement held for unread rows held when one row is fixed', async () => {
    const { rows, statements } = service(heldStatement(8), 2);

    const result = await rows.recheck('st-1', 'u-1', 'ws-1');

    expect(result).toMatchObject({ status: StatementStatus.NEEDS_REVIEW, passed: false });
    expect(result.reasonCodes).toContain('rows_dropped');
    expect(statements.update).toHaveBeenCalledWith(
      { id: 'st-1', workspaceId: 'ws-1' },
      expect.objectContaining({ status: StatementStatus.NEEDS_REVIEW }),
    );
  });

  it('completes it once the rows added by hand outweigh the unread ones', async () => {
    const { rows } = service(heldStatement(1), 9);

    expect(await rows.recheck('st-1', 'u-1', 'ws-1')).toMatchObject({
      status: StatementStatus.COMPLETED,
      passed: true,
    });
  });

  it('counts the rows as the parse did: half dropped does not hold', async () => {
    const { rows } = service(heldStatement(5), 5);

    expect(await rows.recheck('st-1', 'u-1', 'ws-1')).toMatchObject({ passed: true });
  });

  it('counts flagged duplicates among the kept rows, as the parse does', async () => {
    // 4 of 10 dropped (under half); 3 of the 6 kept are duplicates of an earlier upload.
    const { rows } = service(heldStatement(4), 6, 3);

    const result = await rows.recheck('st-1', 'u-1', 'ws-1');

    expect(result.reasonCodes).not.toContain('rows_dropped');
    expect(result.passed).toBe(true);
  });

  it('never says no row was kept when the kept ones are all duplicates', async () => {
    const { rows } = service(heldStatement(1), 3, 3);

    expect((await rows.recheck('st-1', 'u-1', 'ws-1')).reasonCodes).not.toContain('no_rows_kept');
  });
});
