import { SubscriptionFrequency } from '@/entities/subscription.entity';
import { projectSubscriptionCharges } from '@/modules/dashboard/commitment-projections';

const day = (date: Date) => [date.getFullYear(), date.getMonth() + 1, date.getDate()];

describe('projectSubscriptionCharges', () => {
  it('charges on the 31st again after a short month', () => {
    const charges = projectSubscriptionCharges(
      new Date(2026, 0, 31),
      SubscriptionFrequency.MONTHLY,
      new Date(2026, 0, 1),
      new Date(2026, 4, 31),
      400,
    );

    expect(charges.map(day)).toEqual([
      [2026, 1, 31],
      [2026, 2, 28],
      [2026, 3, 31],
      [2026, 4, 30],
      [2026, 5, 31],
    ]);
  });

  it('rolls a next charge left in the past forward to the next real one', () => {
    const charges = projectSubscriptionCharges(
      new Date(2025, 11, 31),
      SubscriptionFrequency.MONTHLY,
      new Date(2026, 2, 15),
      new Date(2026, 4, 1),
      400,
    );

    expect(charges.map(day)).toEqual([
      [2026, 3, 31],
      [2026, 4, 30],
    ]);
  });
});
