'use client';

import { Button } from '@mui/material';
import { Plus, X } from '@/app/components/icons';
import { OWNER_SHARED } from '@/app/components/transactions/OwnerFilterDropdown';
import { Select } from '@/app/components/ui/select';
import { useIntlayer } from '@/app/i18n';
import { RuleConditionValue } from './RuleConditionValue';
import {
  EMPTY_CONDITION,
  MULTI_VALUE_FIELDS,
  operatorsFor,
  type RuleCondition,
  type RuleField,
  type RuleMatchMode,
  TEXT_FIELDS,
} from './types';
import { useRuleWords } from './useRuleWords';

interface RuleConditionsFieldProps {
  conditions: RuleCondition[];
  onChange: (conditions: RuleCondition[]) => void;
  /** Whether a row has to pass all of the conditions or any one of them. */
  matchMode: RuleMatchMode;
  onMatchModeChange: (matchMode: RuleMatchMode) => void;
  /** Who a row can belong to; empty in a workspace of one, which hides the owner field. */
  ownerOptions: Option[];
  hasMembers: boolean;
  /** The workspace's accounts; none hides the account field. */
  walletOptions: Option[];
}

type Option = { value: string; label: string };

/** The editor's conditions: rows of field, check and value, of which all or any one must hold. */
export function RuleConditionsField({
  conditions,
  onChange,
  matchMode,
  onMatchModeChange,
  ownerOptions,
  hasMembers,
  walletOptions,
}: RuleConditionsFieldProps) {
  const t = useIntlayer('categorizationRules');
  const words = useRuleWords();

  const fieldOptions: RuleField[] = [
    ...TEXT_FIELDS,
    'amount',
    'currency',
    'day_of_month',
    'direction',
    'payment_type',
    ...(walletOptions.length > 0 ? (['wallet'] as RuleField[]) : []),
    ...(hasMembers ? (['owner'] as RuleField[]) : []),
  ];
  // Fields whose value is picked from a list rather than typed.
  const choices: Partial<Record<RuleField, Option[]>> = {
    owner: ownerOptions,
    wallet: walletOptions,
    payment_type: Object.entries(words.paymentType).map(([value, label]) => ({ value, label })),
    direction: [
      { value: 'expense', label: words.direction.expense },
      { value: 'income', label: words.direction.income },
    ],
  };

  const setCondition = (index: number, next: RuleCondition) =>
    onChange(conditions.map((condition, at) => (at === index ? next : condition)));

  const changeField = (index: number, field: RuleField) =>
    setCondition(index, {
      field,
      operator: operatorsFor(field)[0],
      value: field === 'owner' ? OWNER_SHARED : (choices[field]?.[0]?.value ?? ''),
    });

  // What a check keeps of the condition: a range's upper end goes with the range.
  const changeOperator = (index: number, operator: RuleCondition['operator']) => {
    const { valueTo, ...rest } = conditions[index];
    setCondition(index, { ...rest, operator, ...(operator === 'between' ? { valueTo } : {}) });
  };

  return (
    <fieldset className="seneca-rule-dialog__group">
      <legend className="seneca-rule-dialog__label">
        {conditions.length > 1 ? (
          <Select
            inputProps={{ 'aria-label': t.dialog.matchModeLabel.value }}
            value={matchMode}
            onChange={value => onMatchModeChange(value === 'any' ? 'any' : 'all')}
            options={[
              { value: 'all', label: t.dialog.conditionsLabel.value },
              { value: 'any', label: t.dialog.conditionsLabelAny.value },
            ]}
            size="small"
          />
        ) : (
          t.dialog.conditionsLabel
        )}
      </legend>
      {conditions.map((condition, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: rows have no identity but their place
        <div className="seneca-rule-dialog__condition" key={index}>
          <Select
            inputProps={{ 'aria-label': t.dialog.fieldLabel.value }}
            value={condition.field}
            onChange={value => changeField(index, value as RuleField)}
            options={[...new Set([...fieldOptions, condition.field])].map(field => ({
              value: field,
              label: words.field[field],
            }))}
            size="small"
          />
          <Select
            inputProps={{ 'aria-label': t.dialog.operatorLabel.value }}
            value={condition.operator}
            onChange={value => changeOperator(index, value as RuleCondition['operator'])}
            options={[...new Set([...operatorsFor(condition.field), condition.operator])].map(
              operator => ({ value: operator, label: words.operator[operator] }),
            )}
            size="small"
          />
          <RuleConditionValue
            condition={condition}
            onChange={next => setCondition(index, next)}
            choices={choices[condition.field]}
          />
          {conditions.length > 1 && (
            <button
              type="button"
              className="seneca-rule-dialog__remove"
              aria-label={t.dialog.removeCondition.value}
              onClick={() => onChange(conditions.filter((_, at) => at !== index))}
            >
              <X size={16} />
            </button>
          )}
        </div>
      ))}
      {conditions.some(condition => MULTI_VALUE_FIELDS.includes(condition.field)) && (
        <span className="seneca-rule-dialog__hint">{t.dialog.valuesHint}</span>
      )}
      <Button
        type="button"
        variant="text"
        size="small"
        startIcon={<Plus size={16} />}
        onClick={() => onChange([...conditions, EMPTY_CONDITION])}
        sx={{ alignSelf: 'flex-start' }}
      >
        {t.dialog.addCondition}
      </Button>
    </fieldset>
  );
}
