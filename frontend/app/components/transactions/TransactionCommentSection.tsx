'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useIntlayer, useLocale } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { invalidateFinancialData } from '@/app/lib/invalidate-document-lists';
import type { ContractInput } from '@/app/lib/query-fn-schema';
import { useTransactionCommentEdit } from './hooks/useTransactionHistory';

interface TransactionCommentSectionProps {
  transactionId: string;
  comment: string | null;
}

/**
 * The row's own comment: a short remark that goes to exports and that a rule
 * can fill in. Saved when the field is left. The Notes tab is something else:
 * what the household says to each other about the row. Anyone in the
 * household may rewrite it, so a quiet line under it says who did last.
 */
export function TransactionCommentSection({
  transactionId,
  comment,
}: TransactionCommentSectionProps) {
  const t = useIntlayer('transactionsDrawer');
  const [text, setText] = useState(comment ?? '');
  const [saved, setSaved] = useState(comment ?? '');
  const save = useMutation({
    mutationFn: async (comments: string) => {
      // PUT: the API has no PATCH route for transactions.
      await apiClient.put(`/transactions/${transactionId}`, {
        comments: comments || null,
      } satisfies ContractInput<'UpdateTransactionBody'>);
    },
    onSuccess: (_answer, comments) => {
      setSaved(comments);
      invalidateFinancialData();
    },
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 24 }}>
      <label htmlFor="transaction-comment" className="seneca-tx-detail__field-label">
        {t.commentLabel}
      </label>
      <input
        id="transaction-comment"
        className="seneca-rule-dialog__input"
        value={text}
        maxLength={1000}
        placeholder={t.commentPlaceholder.value}
        onChange={event => setText(event.target.value)}
        onBlur={() => {
          const next = text.trim();
          if (next !== saved) {
            save.mutate(next);
          }
        }}
      />
      <CommentEditedLine transactionId={transactionId} />
    </div>
  );
}

/** "Edited · Member Two · 12 May": who last changed the comment, and when, in full on hover. */
function CommentEditedLine({ transactionId }: { transactionId: string }) {
  const t = useIntlayer('transactionsDrawer');
  const { locale } = useLocale();
  const edit = useTransactionCommentEdit(transactionId).data?.edit;
  if (!edit) {
    return null;
  }
  const at = new Date(edit.at);
  const sameYear = at.getFullYear() === new Date().getFullYear();
  const day = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(at);
  const full = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
    at,
  );
  const who = edit.by === 'you' ? [t.commentEditedByYou.value] : [t.commentEdited.value, edit.name];
  return (
    <span title={full} style={{ fontSize: 13, color: 'var(--text-muted)' }}>
      {[...who, day].filter(Boolean).join(' · ')}
    </span>
  );
}
