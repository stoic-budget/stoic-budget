import type { FindOperator, Repository } from 'typeorm';
import {
  type Subscription,
  SubscriptionFrequency,
  SubscriptionRiskStatus,
} from '../../../../src/entities/subscription.entity';
import type { SubscriptionCharge } from '../../../../src/entities/subscription-charge.entity';
import { advancePastDue, chargeArrived } from '../../../../src/modules/subscriptions/missed-charge';

/** A charge table holding these days for subscription sub-1 of ws-1, which has a payee rule. */
const charged = (...days: string[]) => withRule(true, days);
const withRule = (rule: boolean, days: string[]) =>
  ({
    manager: { query: vi.fn(async () => (rule ? [{ '?column?': 1 }] : [])) },
    exists: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
      if (where.workspaceId !== 'ws-1' || where.subscriptionId !== 'sub-1') return false;
      const range = where.chargeDate as FindOperator<Date> | undefined;
      if (!range) return days.length > 0;
      const [from, until] = range.value as unknown as [Date, Date];
      return days.some(day => {
        const at = new Date(day);
        return at >= from && at <= until;
      });
    }),
  }) as unknown as Repository<SubscriptionCharge>;

const subscription = (overrides: Partial<Subscription> = {}) =>
  ({
    id: 'sub-1',
    workspaceId: 'ws-1',
    frequency: SubscriptionFrequency.MONTHLY,
    lastChargeDate: new Date('2026-10-10'),
    nextChargeDate: new Date('2026-11-10'),
    riskStatus: SubscriptionRiskStatus.NONE,
    ...overrides,
  }) as Subscription;

describe('advancePastDue', () => {
  it("moves to the next date and judges the previous one: October's payment came", async () => {
    const sub = subscription();

    await advancePastDue(sub, charged('2026-10-12'));

    expect(sub.nextChargeDate).toEqual(new Date('2026-12-10'));
    expect(sub.riskStatus).toBe(SubscriptionRiskStatus.NONE);
  });

  it("does not hold today's payment against it, only the previous cycle's", async () => {
    // October's came; November's (due today) has not arrived yet.
    const sub = subscription();

    await advancePastDue(sub, charged('2026-09-11', '2026-10-11'));

    expect(sub.riskStatus).toBe(SubscriptionRiskStatus.NONE);
  });

  it('flags the charge missing when nothing came for the previous due date', async () => {
    const sub = subscription();

    await advancePastDue(sub, charged('2026-09-10'));

    expect(sub.riskStatus).toBe(SubscriptionRiskStatus.MISSING_CHARGE);
  });

  it('counts a payment that came up to two weeks early', async () => {
    const sub = subscription({ frequency: SubscriptionFrequency.ANNUAL, nextChargeDate: new Date('2027-01-15') });

    // Paid on 5 January for the renewal due on 15 January 2026.
    await advancePastDue(sub, charged('2026-01-05'));

    expect(sub.riskStatus).toBe(SubscriptionRiskStatus.NONE);
  });

  it('notices one skipped week', async () => {
    const sub = subscription({ frequency: SubscriptionFrequency.WEEKLY, nextChargeDate: new Date('2026-02-16') });

    await advancePastDue(sub, charged('2026-02-02', '2026-02-16', '2026-02-23'));

    expect(sub.riskStatus).toBe(SubscriptionRiskStatus.MISSING_CHARGE);
  });

  it('judges nothing for a subscription without a payee rule, even with charges from its confirmation', async () => {
    const sub = subscription();

    await advancePastDue(sub, withRule(false, ['2026-08-10', '2026-09-10']));

    expect(sub.riskStatus).toBe(SubscriptionRiskStatus.NONE);
  });

  it('clears an old flag once the window has a charge, and keeps a price change', async () => {
    const flagged = subscription({ riskStatus: SubscriptionRiskStatus.MISSING_CHARGE });
    const priced = subscription({ riskStatus: SubscriptionRiskStatus.PRICE_CHANGED });

    await advancePastDue(flagged, charged('2026-10-10'));
    await advancePastDue(priced, charged('2026-09-10'));

    expect(flagged.riskStatus).toBe(SubscriptionRiskStatus.NONE);
    expect(priced.riskStatus).toBe(SubscriptionRiskStatus.PRICE_CHANGED);
  });
});

describe('chargeArrived', () => {
  it('clears "missing charge", and leaves a price change alone', () => {
    const missing = subscription({ riskStatus: SubscriptionRiskStatus.MISSING_CHARGE });
    const priced = subscription({ riskStatus: SubscriptionRiskStatus.PRICE_CHANGED });

    chargeArrived(missing);
    chargeArrived(priced);

    expect(missing.riskStatus).toBe(SubscriptionRiskStatus.NONE);
    expect(priced.riskStatus).toBe(SubscriptionRiskStatus.PRICE_CHANGED);
  });
});
