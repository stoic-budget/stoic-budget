import type {
  SubscriptionFrequency,
  SubscriptionRiskStatus,
} from '../../entities/subscription.entity';

export interface BusinessSubscriptionsReport {
  currency: string;
  rows: Array<{
    id: string;
    vendorName: string;
    owner: string | null;
    ownerId: string | null;
    monthlyCost: number;
    frequency: SubscriptionFrequency;
    amount: number;
    subscriptionCurrency: string;
    nextChargeDate: Date | null;
    reviewAt: Date | null;
    riskStatus: SubscriptionRiskStatus;
  }>;
  byOwner: Array<{
    owner: string | null;
    ownerId: string | null;
    monthlyCost: number;
    count: number;
  }>;
  totalMonthlyCost: number;
}
