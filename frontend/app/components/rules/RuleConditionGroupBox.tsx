'use client';

import { Button } from '@mui/material';
import { Plus, X } from '@/app/components/icons';
import { Select } from '@/app/components/ui/select';
import { useIntlayer } from '@/app/i18n';
import { type RuleConditionChoices, RuleConditionRow } from './RuleConditionRow';
import { EMPTY_CONDITION, type RuleConditionGroup } from './types';

interface RuleConditionGroupBoxProps {
  group: RuleConditionGroup;
  onChange: (group: RuleConditionGroup) => void;
  onRemove: () => void;
  choices: RuleConditionChoices;
}

/** A group of conditions inside the rule: all of them or any one, as one condition. */
export function RuleConditionGroupBox({
  group,
  onChange,
  onRemove,
  choices,
}: RuleConditionGroupBoxProps) {
  const t = useIntlayer('categorizationRules');
  const { conditions } = group;

  return (
    <fieldset className="seneca-rule-dialog__subgroup">
      <legend className="seneca-rule-dialog__subgroup-head">
        <Select
          inputProps={{ 'aria-label': t.dialog.groupMatchLabel.value }}
          value={group.matchMode}
          onChange={value => onChange({ ...group, matchMode: value === 'all' ? 'all' : 'any' })}
          options={[
            { value: 'any', label: t.dialog.groupAny.value },
            { value: 'all', label: t.dialog.groupAll.value },
          ]}
          size="small"
        />
        <button
          type="button"
          className="seneca-rule-dialog__remove"
          aria-label={t.dialog.removeGroup.value}
          onClick={onRemove}
        >
          <X size={16} />
        </button>
      </legend>
      {conditions.map((condition, index) => (
        <RuleConditionRow
          // biome-ignore lint/suspicious/noArrayIndexKey: rows have no identity but their place
          key={index}
          condition={condition}
          choices={choices}
          onChange={next =>
            onChange({
              ...group,
              conditions: conditions.map((one, at) => (at === index ? next : one)),
            })
          }
          onRemove={
            conditions.length > 1
              ? () => onChange({ ...group, conditions: conditions.filter((_, at) => at !== index) })
              : undefined
          }
        />
      ))}
      <Button
        type="button"
        variant="text"
        size="small"
        startIcon={<Plus size={16} />}
        onClick={() => onChange({ ...group, conditions: [...conditions, EMPTY_CONDITION] })}
        sx={{ alignSelf: 'flex-start' }}
      >
        {t.dialog.addCondition}
      </Button>
    </fieldset>
  );
}
