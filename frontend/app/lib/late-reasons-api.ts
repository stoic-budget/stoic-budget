import apiClient from '@/app/lib/api';
import type { LatePaymentsSummary, LateReason } from '@/app/lib/contracts';
import { apiQueryDecoded, type ContractInput, checkContract } from '@/app/lib/query-fn-schema';

export type { LatePaymentsSummary, LateReason } from '@/app/lib/contracts';

/** The six reasons, in the order the question lists them. */
export const LATE_REASONS: readonly LateReason[] = [
  'forgot',
  'short_before_payday',
  'income_late',
  'unexpected_expense',
  'bank_or_payment_issue',
  'other',
];

/** Why a bill was paid late, and what those reasons add up to over a year. */
export const lateReasonsApi = {
  async set(id: string, reason: LateReason | null, note?: string | null) {
    const response = await apiClient.put(`/payables/${id}/late-reason`, {
      reason,
      note: note?.trim() || null,
    } satisfies ContractInput<'SetPayableLateReasonBody'>);
    return checkContract('Payable', response.data, '/payables/:id/late-reason');
  },

  async summary(): Promise<LatePaymentsSummary> {
    return apiQueryDecoded({ url: '/late-payments/summary', contract: 'LatePaymentsSummary' });
  },
};
