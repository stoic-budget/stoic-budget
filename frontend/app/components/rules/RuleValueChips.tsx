'use client';

import { X } from '@/app/components/icons';

interface RuleValueChipsProps {
  /** The values so far; the last one is the text still being typed. */
  values: string[];
  onChange: (values: string[]) => void;
  /** Names the input for a screen reader. */
  label: string;
  removeLabel: (value: string) => string;
}

/**
 * The value of a condition that can hold several: Enter keeps what was typed
 * as a chip and starts the next one. With nothing typed, Enter is the form's
 * (it saves) and Backspace takes the last chip back.
 */
export function RuleValueChips({ values, onChange, label, removeLabel }: RuleValueChipsProps) {
  const kept = values.slice(0, -1);
  const typed = values[values.length - 1] ?? '';

  return (
    <div className="seneca-rule-values">
      {kept.map((value, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: values have no identity but their place
        <span key={index} className="seneca-tag-picker__chip">
          {value}
          <button
            type="button"
            className="seneca-tag-picker__remove"
            aria-label={removeLabel(value)}
            onClick={() => onChange(values.filter((_, at) => at !== index))}
          >
            <X size={12} aria-hidden />
          </button>
        </span>
      ))}
      <input
        aria-label={label}
        className="seneca-rule-dialog__input"
        value={typed}
        onChange={event => onChange([...kept, event.target.value])}
        onKeyDown={event => {
          if (event.key === 'Enter' && typed.trim() !== '') {
            event.preventDefault();
            onChange([...kept, typed, '']);
          } else if (event.key === 'Backspace' && typed === '' && kept.length > 0) {
            event.preventDefault();
            onChange(kept);
          }
        }}
      />
    </div>
  );
}
