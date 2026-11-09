'use client';

import { Button } from '@mui/material';
import { Plus } from '@/app/components/icons';
import { Select } from '@/app/components/ui/select';
import { useIntlayer } from '@/app/i18n';
import type { CategoryList } from '@/app/lib/contracts';
import { RuleConditionGroupBox } from './RuleConditionGroupBox';
import { type RuleConditionChoices, RuleConditionRow, type RuleOption } from './RuleConditionRow';
import {
  EMPTY_CONDITION,
  EMPTY_GROUP,
  isGroup,
  MULTI_VALUE_FIELDS,
  type RuleField,
  type RuleMatchMode,
  type RuleNode,
  TEXT_FIELDS,
} from './types';
import { useRuleWords } from './useRuleWords';

interface RuleConditionsFieldProps {
  conditions: RuleNode[];
  onChange: (conditions: RuleNode[]) => void;
  /** Whether a row has to pass all of the conditions or any one of them. */
  matchMode: RuleMatchMode;
  onMatchModeChange: (matchMode: RuleMatchMode) => void;
  /** Who a row can belong to; empty in a workspace of one, which hides the owner field. */
  ownerOptions: RuleOption[];
  hasMembers: boolean;
  /** The workspace's accounts; none hides the account field. */
  walletOptions: RuleOption[];
  categories: CategoryList;
}

/** Fields that read the row as the rules above this one leave it. */
const LAYERED_FIELDS: RuleField[] = ['category', 'payee', 'tags', 'comment'];

/**
 * The editor's conditions: rows of field, check and value, and groups of them,
 * of which all or any one must hold.
 */
export function RuleConditionsField({
  conditions,
  onChange,
  matchMode,
  onMatchModeChange,
  ownerOptions,
  hasMembers,
  walletOptions,
  categories,
}: RuleConditionsFieldProps) {
  const t = useIntlayer('categorizationRules');
  const words = useRuleWords();

  const choices: RuleConditionChoices = {
    fields: [
      ...TEXT_FIELDS,
      'amount',
      'currency',
      'day_of_month',
      'direction',
      'payment_type',
      ...(walletOptions.length > 0 ? (['wallet'] as RuleField[]) : []),
      ...(hasMembers ? (['owner'] as RuleField[]) : []),
      ...LAYERED_FIELDS,
    ],
    lists: {
      owner: ownerOptions,
      wallet: walletOptions,
      payment_type: Object.entries(words.paymentType).map(([value, label]) => ({ value, label })),
      direction: [
        { value: 'expense', label: words.direction.expense },
        { value: 'income', label: words.direction.income },
      ],
    },
    categories,
  };

  const setNode = (index: number, next: RuleNode) =>
    onChange(conditions.map((node, at) => (at === index ? next : node)));
  const removeNode = (index: number) => onChange(conditions.filter((_, at) => at !== index));
  const leaves = conditions.flatMap(node => (isGroup(node) ? node.conditions : [node]));

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
      {conditions.map((node, index) =>
        isGroup(node) ? (
          <RuleConditionGroupBox
            // biome-ignore lint/suspicious/noArrayIndexKey: rows have no identity but their place
            key={index}
            group={node}
            choices={choices}
            onChange={next => setNode(index, next)}
            onRemove={() => removeNode(index)}
          />
        ) : (
          <RuleConditionRow
            // biome-ignore lint/suspicious/noArrayIndexKey: rows have no identity but their place
            key={index}
            condition={node}
            choices={choices}
            onChange={next => setNode(index, next)}
            onRemove={conditions.length > 1 ? () => removeNode(index) : undefined}
          />
        ),
      )}
      {leaves.some(condition => MULTI_VALUE_FIELDS.includes(condition.field)) && (
        <span className="seneca-rule-dialog__hint">{t.dialog.valuesHint}</span>
      )}
      {leaves.some(condition => LAYERED_FIELDS.includes(condition.field)) && (
        <span className="seneca-rule-dialog__hint">{t.dialog.stateHint}</span>
      )}
      <div className="seneca-rule-dialog__adders">
        <Button
          type="button"
          variant="text"
          size="small"
          startIcon={<Plus size={16} />}
          onClick={() => onChange([...conditions, EMPTY_CONDITION])}
        >
          {t.dialog.addCondition}
        </Button>
        <Button
          type="button"
          variant="text"
          size="small"
          startIcon={<Plus size={16} />}
          onClick={() => onChange([...conditions, EMPTY_GROUP])}
        >
          {t.dialog.addGroup}
        </Button>
      </div>
    </fieldset>
  );
}
