import type { Repository } from 'typeorm';
import {
  type Subscription,
  SubscriptionFrequency,
  SubscriptionRiskStatus,
} from '../../../../src/entities/subscription.entity';
import type { SubscriptionCharge } from '../../../../src/entities/subscription-charge.entity';
import { advancePastDue, chargeArrived } from '../../../../src/modules/subscriptions/missed-charge';

const nextMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, date.getDate());
const charges = (charged: boolean) =>
  ({ exists: vi.fn(async () => charged) }) as unknown as Repository<SubscriptionCharge>;
const subscription = (overrides: Partial<Subscription> = {}) =>
  ({
    id: 'sub-1',
    workspaceId: 'ws-1',
    frequency: SubscriptionFrequency.MONTHLY,
    lastChargeDate: new Date(2026, 9, 5),
    nextChargeDate: new Date(2026, 10, 5),
    riskStatus: SubscriptionRiskStatus.NONE,
    ...overrides,
  }) as Subscription;

describe('advancePastDue', () => {
  it('moves to the next date and raises no flag on the payment day itself', async () => {
    const sub = subscription();

    await advancePastDue(sub, charges(true), nextMonth);

    expect(sub.nextChargeDate).toEqual(new Date(2026, 11, 5));
    expect(sub.riskStatus).toBe(SubscriptionRiskStatus.NONE);
  });

  it('flags the charge missing once the previous due date had a cycle and nothing came', async () => {
    const sub = subscription();

    await advancePastDue(sub, charges(false), nextMonth);

    expect(sub.riskStatus).toBe(SubscriptionRiskStatus.MISSING_CHARGE);
  });

  it('judges nothing for a subscription with no earlier due date', async () => {
    const sub = subscription({ lastChargeDate: null as never });
    const repo = charges(false);

    await advancePastDue(sub, repo, nextMonth);

    expect(sub.riskStatus).toBe(SubscriptionRiskStatus.NONE);
    expect(repo.exists).not.toHaveBeenCalled();
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
