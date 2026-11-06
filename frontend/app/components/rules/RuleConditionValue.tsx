'use client';

import { Select } from '@/app/components/ui/select';
import { useIntlayer } from '@/app/i18n';
import { RuleValueChips } from './RuleValueChips';
import { fill } from './rule-text';
import { MULTI_VALUE_FIELDS, NUMBER_FIELDS, type RuleCondition, valuesOf } from './types';

interface RuleConditionValueProps {
  condition: RuleCondition;
  onChange: (condition: RuleCondition) => void;
  /** The list a value is picked from, for a field that has one. */
  choices?: { value: string; label: string }[];
}

/** A typed number, or nothing while the box is empty. */
const numberOf = (text: string): number | undefined => (text === '' ? undefined : Number(text));

/** The value of one condition: picked from a list, a number or a range, or text that can hold several. */
export function RuleConditionValue({ condition, onChange, choices }: RuleConditionValueProps) {
  const t = useIntlayer('categorizationRules');

  if (choices) {
    return (
      <Select
        inputProps={{ 'aria-label': t.dialog.valueLabel.value }}
        value={String(condition.value)}
        onChange={value => onChange({ ...condition, value })}
        options={choices}
        size="small"
      />
    );
  }
  if (NUMBER_FIELDS.includes(condition.field)) {
    const range = condition.operator === 'between';
    return (
      <div
        className={range ? 'seneca-rule-values seneca-rule-values--range' : 'seneca-rule-values'}
      >
        <input
          aria-label={range ? t.dialog.fromLabel.value : t.dialog.valueLabel.value}
          placeholder={range ? t.dialog.fromLabel.value : undefined}
          className="seneca-rule-dialog__input"
          type="number"
          inputMode="decimal"
          value={String(condition.value)}
          onChange={event => onChange({ ...condition, value: event.target.value })}
        />
        {range && (
          <input
            aria-label={t.dialog.toLabel.value}
            placeholder={t.dialog.toLabel.value}
            className="seneca-rule-dialog__input"
            type="number"
            inputMode="decimal"
            value={condition.valueTo ?? ''}
            onChange={event => onChange({ ...condition, valueTo: numberOf(event.target.value) })}
          />
        )}
      </div>
    );
  }
  if (MULTI_VALUE_FIELDS.includes(condition.field)) {
    return (
      <RuleValueChips
        values={valuesOf(condition)}
        // One value stays a plain one, as every rule saved so far holds it.
        onChange={values =>
          onChange({ ...condition, value: values.length === 1 ? values[0] : values })
        }
        label={t.dialog.valueLabel.value}
        removeLabel={value => fill(t.dialog.removeValue.value, { value })}
      />
    );
  }
  return (
    <input
      aria-label={t.dialog.valueLabel.value}
      className="seneca-rule-dialog__input"
      value={String(condition.value)}
      onChange={event => onChange({ ...condition, value: event.target.value })}
    />
  );
}
