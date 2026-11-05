'use client';

import toast from 'react-hot-toast';
import { offerAction } from '@/app/components/payees/offer-action-toast';
import { useIntlayer } from '@/app/i18n';
import { describeApplied, fill } from './rule-text';
import type { Rule } from './types';
import { useApplyRule } from './useRules';

type Applied = Pick<Rule, 'id' | 'result'>;

/**
 * Applying a rule to the rows that already exist, and saying what it did.
 * `walletName` names the account a rule moves rows to.
 */
export function useRuleApply(walletName: (id: string) => string | null) {
  const t = useIntlayer('categorizationRules');
  const apply = useApplyRule();
  const nameOf = (rule: Applied) =>
    (rule.result.walletId && walletName(rule.result.walletId)) || t.result.unknown.value;

  const run = (rule: Applied) =>
    void apply.mutateAsync(rule.id).then(
      done =>
        toast.success(
          describeApplied(
            done,
            {
              applied: t.toast.applied.value,
              appliedAll: t.toast.appliedAll.value,
              movedPart: t.toast.movedPart.value,
            },
            nameOf(rule),
          ),
        ),
      () => toast.error(t.toast.applyFailed.value),
    );

  /** Asks first, with `message`; moving rows between accounts is never done unasked. */
  const offer = (rule: Applied, message: string) =>
    offerAction({
      message,
      applyLabel: t.toast.apply.value,
      dismissLabel: t.toast.notNow.value,
      onApply: () => run(rule),
    });

  /** The question for a rule that would move `count` rows to its account. */
  const moveQuestion = (rule: Applied, count: number) =>
    fill(t.toast.applyOfferMove.value, { count, wallet: nameOf(rule) });

  return { run, offer, moveQuestion };
}
