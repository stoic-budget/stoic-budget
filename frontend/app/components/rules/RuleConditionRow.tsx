'use client';

import { X } from '@/app/components/icons';
import { OWNER_SHARED } from '@/app/components/transactions/OwnerFilterDropdown';
import { Select } from '@/app/components/ui/select';
import { useIntlayer } from '@/app/i18n';
import type { CategoryList } from '@/app/lib/contracts';
import { RuleConditionValue } from './RuleConditionValue';
import { operatorWord } from './rule-text';
import { operatorsFor, type RuleCondition, type RuleField, VALUELESS_OPERATORS } from './types';
import { useRuleWords } from './useRuleWords';

export type RuleOption = { value: string; label: string };

/** What every condition of the editor is offered: its fields, and where values come from. */
export interface RuleConditionChoices {
  fields: RuleField[];
  /** Fields whose value is picked from a short list rather than typed. */
  lists: Partial<Record<RuleField, RuleOption[]>>;
  categories: CategoryList;
}

interface RuleConditionRowProps {
  condition: RuleCondition;
  onChange: (condition: RuleCondition) => void;
  /** Absent for the last condition left, which stays. */
  onRemove?: () => void;
  choices: RuleConditionChoices;
}

/** One condition: field, check and value on a line, and a button to take it away. */
export function RuleConditionRow({
  condition,
  onChange,
  onRemove,
  choices,
}: RuleConditionRowProps) {
  const t = useIntlayer('categorizationRules');
  const words = useRuleWords();

  const changeField = (field: RuleField) =>
    onChange({
      field,
      operator: operatorsFor(field)[0],
      value: field === 'owner' ? OWNER_SHARED : (choices.lists[field]?.[0]?.value ?? ''),
    });

  // What a check keeps of the condition: a range's upper end goes with the range,
  // and a blank check holds no value.
  const changeOperator = (operator: RuleCondition['operator']) => {
    const { valueTo, ...rest } = condition;
    onChange({
      ...rest,
      operator,
      ...(operator === 'between' ? { valueTo } : {}),
      ...(VALUELESS_OPERATORS.includes(operator) ? { value: '' } : {}),
    });
  };

  return (
    <div className="seneca-rule-dialog__condition">
      <Select
        inputProps={{ 'aria-label': t.dialog.fieldLabel.value }}
        value={condition.field}
        onChange={value => changeField(value as RuleField)}
        options={[...new Set([...choices.fields, condition.field])].map(field => ({
          value: field,
          label: words.field[field],
        }))}
        size="small"
      />
      <Select
        inputProps={{ 'aria-label': t.dialog.operatorLabel.value }}
        value={condition.operator}
        onChange={value => changeOperator(value as RuleCondition['operator'])}
        options={[...new Set([...operatorsFor(condition.field), condition.operator])].map(
          operator => ({
            value: operator,
            label: operatorWord({ field: condition.field, operator }, words),
          }),
        )}
        size="small"
      />
      {VALUELESS_OPERATORS.includes(condition.operator) ? (
        // Keeps the remove button in its column; on a phone it sits beside the check.
        <span className="seneca-rule-dialog__no-value" />
      ) : (
        <RuleConditionValue
          condition={condition}
          onChange={onChange}
          choices={choices.lists[condition.field]}
          categories={choices.categories}
        />
      )}
      {onRemove && (
        <button
          type="button"
          className="seneca-rule-dialog__remove"
          aria-label={t.dialog.removeCondition.value}
          onClick={onRemove}
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
