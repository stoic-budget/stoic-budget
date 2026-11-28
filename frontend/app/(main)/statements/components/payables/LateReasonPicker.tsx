'use client';

import type React from 'react';
import { ChoiceCards } from '@/app/components/ui/choice-cards';
import { useIntlayer } from '@/app/i18n';
import type { LateReason } from '@/app/lib/late-reasons-api';
import { useLateReasonLabels } from './hooks/useLateReasons';

/** In the payment dialog of a bill paid after its due date: the same question, skippable. */
export function LateReasonPicker({
  value,
  onChange,
}: {
  value: LateReason | null;
  onChange: (reason: LateReason) => void;
}): React.JSX.Element {
  const t = useIntlayer('lateReasons');
  const options = useLateReasonLabels();
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <span id="late-reason-question" style={{ fontSize: 15, fontWeight: 500 }}>
        {t.question.value}
      </span>
      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t.optionalHint.value}</span>
      <ChoiceCards<LateReason>
        aria-labelledby="late-reason-question"
        options={options.map(option => ({ value: option.value, title: option.label }))}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}
