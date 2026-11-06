'use client';

import { useState } from 'react';
import { X } from '@/app/components/icons';
import { PayeeDrawer } from '@/app/components/payees/PayeeDrawer';
import { usePayee } from '@/app/components/payees/usePayees';
import { useIntlayer } from '@/app/i18n';
import { fill } from './rule-text';
import type { RuleDraftBody } from './types';

type Result = RuleDraftBody['result'];

/**
 * The payee a matching row is given: one of the workspace's, or a name typed
 * in the drawer that becomes a payee when the rule is saved.
 */
export function RulePayeeAction({
  result,
  onChange,
}: {
  result: Result;
  onChange: (result: Result) => void;
}) {
  const t = useIntlayer('categorizationRules');
  const [choosing, setChoosing] = useState(false);
  const stored = usePayee(result.payeeId ?? null).data;
  const name = result.payeeName ?? stored?.name ?? null;
  const { payeeId: _id, payeeName: _name, ...rest } = result;

  return (
    <>
      <div className="seneca-rule-dialog__action">
        <span className="seneca-rule-dialog__action-label">{t.dialog.payeeLabel}</span>
        <div className="seneca-rule-values">
          {name && (
            <span className="seneca-tag-picker__chip">
              {name}
              <button
                type="button"
                className="seneca-tag-picker__remove"
                aria-label={fill(t.dialog.removeValue.value, { value: name })}
                onClick={() => onChange(rest)}
              >
                <X size={12} aria-hidden />
              </button>
            </span>
          )}
          <button
            type="button"
            className="seneca-tag-picker__add"
            onClick={() => setChoosing(true)}
          >
            {t.dialog.pickPayee}
          </button>
        </div>
      </div>
      {name && <span className="seneca-rule-dialog__hint">{t.dialog.payeeHint}</span>}
      <PayeeDrawer
        open={choosing}
        title={t.dialog.pickPayee.value}
        current={stored ? { id: stored.id, name: stored.name } : null}
        onClose={() => setChoosing(false)}
        onPick={choice => {
          setChoosing(false);
          onChange(
            'payeeId' in choice
              ? { ...rest, payeeId: choice.payeeId }
              : { ...rest, payeeName: choice.name },
          );
        }}
      />
    </>
  );
}
