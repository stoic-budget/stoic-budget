import { attachTarget } from '../../../../src/modules/receipts/helpers/attach-target';

const receipt = (transactionIds: string[]) =>
  ({ metadata: { transactionMatch: { kind: 'single', transactionIds, score: 1 } } }) as never;

describe('attachTarget', () => {
  it('takes the row the person picked, and null as "a new expense"', () => {
    expect(attachTarget('picked', receipt(['bank']), null)).toBe('picked');
    expect(attachTarget(null, receipt(['bank']), null)).toBeNull();
  });

  it('falls back to the stored suggestion', () => {
    expect(attachTarget(undefined, receipt(['bank']), { id: 'scan' })).toBe('bank');
  });

  it("never attaches to the scan's own row a stale suggestion still names", () => {
    expect(attachTarget(undefined, receipt(['scan']), { id: 'scan' })).toBeNull();
    expect(attachTarget(undefined, receipt(['scan', 'bank']), { id: 'scan' })).toBe('bank');
  });
});
