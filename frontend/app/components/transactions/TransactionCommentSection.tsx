'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { invalidateFinancialData } from '@/app/lib/invalidate-document-lists';
import type { ContractInput } from '@/app/lib/query-fn-schema';

interface TransactionCommentSectionProps {
  transactionId: string;
  comment: string | null;
}

/**
 * The row's own comment: a short remark that goes to exports and that a rule
 * can fill in. Saved when the field is left. The Notes tab is something else:
 * what the household says to each other about the row.
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
    </div>
  );
}
