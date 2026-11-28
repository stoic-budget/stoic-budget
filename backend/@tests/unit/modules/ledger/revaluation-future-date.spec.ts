import { LedgerRevaluationService } from '@/modules/ledger/ledger-revaluation.service';

const codeOf = async (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: { getResponse?: () => unknown }) => JSON.stringify(error.getResponse?.() ?? error),
  );

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

/** The service up to its first step after the date check: a ledger that is off. */
function build() {
  const getSettings = vi.fn(async () => ({ baseCurrency: null }));
  const service = new LedgerRevaluationService(
    {} as never,
    {} as never,
    {} as never,
    { getSettings } as never,
    {} as never,
  );
  return service;
}

describe('LedgerRevaluationService date bound', () => {
  it("accepts Greenwich's tomorrow: east of it, that is the person's today", async () => {
    expect(await codeOf(build().revalue('ws-1', 'user-1', day(1)))).toContain('LEDGER_DISABLED');
  });

  it('refuses the day after', async () => {
    expect(await codeOf(build().revalue('ws-1', 'user-1', day(2)))).toContain(
      'LEDGER_REVALUATION_FUTURE',
    );
  });
});
