'use client';

import { Checkbox } from '@/app/components/ui/checkbox';
import { Select } from '@/app/components/ui/select';
import { useIntlayer } from '@/app/i18n';
import type { RuleDraftBody } from './types';

type Result = RuleDraftBody['result'];

/** The select's values beside the members' ids: nobody, and everyone. */
const NOBODY = '';
const EVERYONE = 'everyone';

/**
 * Two things a rule can do besides filing a row: tell people about each new
 * matching row, and leave matching rows out of budgets.
 */
export function RuleNotifyExcludeActions({
  result,
  onChange,
  members,
}: {
  result: Result;
  onChange: (result: Result) => void;
  /** The workspace's members by membership id. */
  members: { value: string; label: string }[];
}) {
  const t = useIntlayer('ruleActions');
  const exclusion = useIntlayer('budgetExclusion');
  const { notify, excludeFromBudgets, ...rest } = result;
  const notifyValue = notify === undefined ? NOBODY : (notify.memberId ?? EVERYONE);
  const keep = { ...rest, ...(excludeFromBudgets ? { excludeFromBudgets } : {}) };

  return (
    <>
      <div className="seneca-rule-dialog__action">
        <span className="seneca-rule-dialog__action-label">{t.notifyLabel}</span>
        <Select
          inputProps={{ 'aria-label': t.notifyLabel.value }}
          value={notifyValue}
          onChange={value =>
            onChange(
              value === NOBODY
                ? keep
                : { ...keep, notify: { memberId: value === EVERYONE ? null : value } },
            )
          }
          options={[
            { value: NOBODY, label: t.notifyOff.value },
            { value: EVERYONE, label: t.notifyEveryone.value },
            ...members,
          ]}
          size="small"
        />
      </div>
      {notify && <span className="seneca-rule-dialog__hint">{t.notifyHint}</span>}
      <Checkbox
        checked={Boolean(excludeFromBudgets)}
        onCheckedChange={checked =>
          onChange({
            ...rest,
            ...(notify ? { notify } : {}),
            ...(checked ? { excludeFromBudgets: true as const } : {}),
          })
        }
        label={exclusion.toggle}
      />
      {excludeFromBudgets && <span className="seneca-rule-dialog__hint">{exclusion.hint}</span>}
    </>
  );
}
