'use client';

import { useIntlayer } from '@/app/i18n';
import type { RuleWords } from './rule-text';

/** The page's words for fields, checks and actions, as strings the helpers can join. */
export function useRuleWords(): RuleWords {
  const t = useIntlayer('categorizationRules');
  const types = useIntlayer('paymentTypes');
  return {
    field: {
      counterparty_name: t.field.counterparty_name.value,
      payment_purpose: t.field.payment_purpose.value,
      amount: t.field.amount.value,
      owner: t.field.owner.value,
      counterparty_bin: t.field.counterparty_bin.value,
      document_number: t.field.document_number.value,
      direction: t.field.direction.value,
      payment_type: t.field.payment_type.value,
      wallet: t.field.wallet.value,
      currency: t.field.currency.value,
      day_of_month: t.field.day_of_month.value,
      category: t.field.category.value,
      payee: t.field.payee.value,
      tags: t.field.tags.value,
      comment: t.field.comment.value,
    },
    operator: {
      contains: t.operator.contains.value,
      equals: t.operator.equals.value,
      starts_with: t.operator.starts_with.value,
      ends_with: t.operator.ends_with.value,
      greater_than: t.operator.greater_than.value,
      less_than: t.operator.less_than.value,
      regex: t.operator.regex.value,
      not_contains: t.operator.not_contains.value,
      not_equals: t.operator.not_equals.value,
      between: t.operator.between.value,
      is_empty: t.operator.is_empty.value,
      is_not_empty: t.operator.is_not_empty.value,
    },
    tagOperator: {
      equals: t.tagOperator.equals.value,
      not_equals: t.tagOperator.not_equals.value,
      is_empty: t.tagOperator.is_empty.value,
      is_not_empty: t.tagOperator.is_not_empty.value,
    },
    direction: { income: t.direction.income.value, expense: t.direction.expense.value },
    paymentType: {
      card: types.card.value,
      bank_transfer_in: types.bank_transfer_in.value,
      bank_transfer_out: types.bank_transfer_out.value,
      direct_debit: types.direct_debit.value,
      standing_order: types.standing_order.value,
      cash: types.cash.value,
      fee: types.fee.value,
      interest: types.interest.value,
    },
    and: t.page.and.value,
    or: t.page.or.value,
    category: t.result.category.value,
    wallet: t.result.wallet.value,
    owner: t.result.owner.value,
    tags: t.result.tags.value,
    comment: t.result.comment.value,
    payee: t.result.payee.value,
    shared: t.result.shared.value,
    unknown: t.result.unknown.value,
  };
}
