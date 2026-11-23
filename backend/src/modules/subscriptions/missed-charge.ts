import { Between, type Repository } from 'typeorm';
import { type Subscription, SubscriptionRiskStatus } from '../../entities/subscription.entity';
import type { SubscriptionCharge } from '../../entities/subscription-charge.entity';
import { chargeAt } from './charge-calendar.util';

const DAY = 24 * 60 * 60 * 1000;
/** How early a payment may come before its due date and still count for it. */
const EARLY_DAYS = 14;

/**
 * Moves a subscription past a due date that came and went without a booked
 * charge, and says whether its payments are on time.
 *
 * Today's payment usually shows up days later, so today's date is not judged:
 * the one before it is, which has had a whole cycle for its payment to come.
 * "Missing charge" means nothing was charged from a little before that date up
 * to today (two weeks, half a cycle for a weekly one); a charge in that window
 * clears it. Only a subscription whose payments get linked (it has at least
 * one charge) is judged: for the others, no charge says nothing about the
 * money. A price change is left as it is. False when there is no date.
 */
export async function advancePastDue(
  subscription: Subscription,
  charges: Repository<SubscriptionCharge>,
): Promise<boolean> {
  const due = subscription.nextChargeDate;
  if (!due) return false;
  const dueDate = new Date(due);
  subscription.lastChargeDate = due;
  subscription.nextChargeDate = chargeAt(dueDate, subscription.frequency, 1);

  const judged =
    subscription.riskStatus === SubscriptionRiskStatus.NONE ||
    subscription.riskStatus === SubscriptionRiskStatus.MISSING_CHARGE;
  const own = { workspaceId: subscription.workspaceId, subscriptionId: subscription.id };
  if (!(judged && (await charges.exists({ where: own })))) {
    return true;
  }
  const previous = chargeAt(dueDate, subscription.frequency, -1);
  const cycleDays = Math.round((dueDate.getTime() - previous.getTime()) / DAY);
  const from = new Date(previous);
  from.setDate(from.getDate() - Math.min(EARLY_DAYS, Math.floor(cycleDays / 2)));
  const until = new Date(dueDate.getTime() - DAY);
  const charged = await charges.exists({ where: { ...own, chargeDate: Between(from, until) } });
  subscription.riskStatus = charged
    ? SubscriptionRiskStatus.NONE
    : SubscriptionRiskStatus.MISSING_CHARGE;
  return true;
}

/** A charge booked: whatever "missing" said, it came. */
export function chargeArrived(subscription: Subscription): void {
  if (subscription.riskStatus === SubscriptionRiskStatus.MISSING_CHARGE) {
    subscription.riskStatus = SubscriptionRiskStatus.NONE;
  }
}
