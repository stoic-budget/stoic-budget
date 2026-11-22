import { UnbookedPaymentsService } from '../../../../src/modules/payables/unbooked-payments.service';

describe('UnbookedPaymentsService and pending bank rows', () => {
  it('never settles a bill with a row the bank has not booked yet', async () => {
    const query = vi.fn(async () => []);
    const service = new UnbookedPaymentsService({ manager: { query } } as never);

    await service.linkUnbooked('ws-1');

    const [sql, params] = query.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain('t.is_pending = false');
    expect(params).toEqual(['ws-1']);
  });
});
