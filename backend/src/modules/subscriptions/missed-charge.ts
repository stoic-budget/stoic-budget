import { Between, type Repository } from 'typeorm';
import {
  type Subscription,
  type SubscriptionFrequency,
  SubscriptionRiskStatus,
} from '../../entities/subscription.entity';
import type { SubscriptionCharge } from '../../entities/subscription-charge.entity';

/** How early a payment may come before its due date and still count for it. */
const EARLY_DAYS = 7;

/**
 * Moves a subscription past a due date that came and went without a booked
 * charge. Its own payment usually shows up days later, so that date is not
 * judged now: the one before it is, which has had a whole cycle for its
 * payment to arrive. "Missing charge" is set only when nothing was charged
 * from a week before that date up to this one. False when there is no date.
 */
export async function advancePastDue(
  subscription: Subscription,
  charges: Repository<SubscriptionCharge>,
  nextAfter: (date: Date, frequency: SubscriptionFrequency) => Date,
): Promise<boolean> {
  const due = subscription.nextChargeDate;
  if (!due) return false;
  const previous = subscription.lastChargeDate;
  subscription.lastChargeDate = due;
  subscription.nextChargeDate = nextAfter(new Date(due), subscription.frequency);
  if (previous && subscription.riskStatus === SubscriptionRiskStatus.NONE) {
    const from = new Date(previous);
    from.setDate(from.getDate() - EARLY_DAYS);
    const charged = await charges.exists({
      where: {
        workspaceId: subscription.workspaceId,
        subscriptionId: subscription.id,
        chargeDate: Between(from, new Date(due)),
      },
    });
    if (!charged) subscription.riskStatus = SubscriptionRiskStatus.MISSING_CHARGE;
  }
  return true;
}

/** A charge booked: whatever "missing" said, it came. */
export function chargeArrived(subscription: Subscription): void {
  if (subscription.riskStatus === SubscriptionRiskStatus.MISSING_CHARGE) {
    subscription.riskStatus = SubscriptionRiskStatus.NONE;
  }
}
