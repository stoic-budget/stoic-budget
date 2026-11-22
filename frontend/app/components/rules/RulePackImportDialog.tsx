'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Checkbox } from '@/app/components/ui/checkbox';
import { FULL_SCREEN_ON_PHONE, ModalFooter, ModalShell } from '@/app/components/ui/modal-shell';
import { useIntlayer } from '@/app/i18n';
import type { RulePack, RulePackPreview } from '@/app/lib/contracts';
import { fill } from './rule-text';
import { useImportRulePack, useRulePackPreview } from './useRulePacks';

type PreviewRule = RulePackPreview['rules'][number];

/**
 * What importing `pack` would do, rule by rule, asked again whenever "create
 * missing" changes. Nothing is written until Import is pressed.
 */
export function RulePackImportDialog({ pack, onClose }: { pack: RulePack; onClose: () => void }) {
  const t = useIntlayer('rulePacks');
  const cancel = useIntlayer('categorizationRules').dialog.cancel;
  const [createMissing, setCreateMissing] = useState(true);
  const preview = useRulePackPreview();
  const importing = useImportRulePack();
  const { mutate } = preview;

  useEffect(() => {
    mutate({ pack, createMissing });
  }, [mutate, pack, createMissing]);

  const kind: Record<PreviewRule['missing'][number]['kind'], string> = {
    category: t.kindCategory.value,
    tag: t.kindTag.value,
    payee: t.kindPayee.value,
    account: t.kindAccount.value,
    member: t.kindMember.value,
  };
  // A blank name is a record deleted where the pack was made.
  const label = (name: PreviewRule['missing'][number]) =>
    `${name.name.trim() || t.deleted.value} (${kind[name.kind]})`;
  const why = (rule: PreviewRule) =>
    rule.exists
      ? t.exists.value
      : rule.invalid
        ? t.invalid.value
        : rule.missing.length > 0
          ? fill(t.missing.value, { names: rule.missing.map(label).join(', ') })
          : null;
  const answer = preview.data;
  const adding = answer?.rules.filter(rule => rule.outcome === 'create').length ?? 0;

  const confirm = () =>
    void importing.mutateAsync({ pack, createMissing }).then(
      done => {
        toast.success(fill(t.imported.value, { created: done.created, skipped: done.skipped }));
        onClose();
      },
      () => toast.error(t.failed.value),
    );

  return (
    <ModalShell
      isOpen
      onClose={onClose}
      size="md"
      title={t.importTitle}
      paperSx={FULL_SCREEN_ON_PHONE}
      footer={
        <ModalFooter
          onCancel={onClose}
          onConfirm={confirm}
          cancelText={cancel.value}
          confirmText={t.import.value}
          isConfirmLoading={importing.isPending}
          isConfirmDisabled={!answer || adding === 0 || preview.isPending || importing.isPending}
        />
      }
    >
      <p className="seneca-rule-dialog__hint">{t.importHint}</p>
      <Checkbox
        checked={createMissing}
        onCheckedChange={setCreateMissing}
        label={t.createMissing}
      />
      {preview.isError && <p className="seneca-rule-pack__error">{t.notPack}</p>}
      {answer && (
        <>
          <p className="seneca-rule-pack__summary">
            {fill(t.summary.value, { count: adding, total: answer.rules.length })}
          </p>
          <ul className="seneca-rule-pack__list">
            <li className="seneca-rule-pack__head" aria-hidden>
              <span>{t.colRule}</span>
              <span>{t.colResult}</span>
              <span className="seneca-rule-pack__num">{t.colMatches}</span>
            </li>
            {answer.rules.map((rule, index) => (
              <li
                // Names repeat in a pack; the place in it does not.
                key={`${index}-${rule.name}`}
                className={`seneca-rule-pack__item${rule.outcome === 'skip' ? ' seneca-rule-pack__item--skip' : ''}`}
              >
                <span className="seneca-rule-pack__name">
                  {rule.name}
                  {rule.folder && <span className="seneca-rule-pack__folder">{rule.folder}</span>}
                </span>
                <span>
                  {rule.outcome === 'create' ? t.willCreate : t.willSkip}
                  {why(rule) && <span className="seneca-rule-pack__why">{why(rule)}</span>}
                </span>
                <span className="seneca-rule-pack__num" data-label={t.colMatches.value}>
                  {rule.matches}
                </span>
              </li>
            ))}
          </ul>
          {answer.newFolders.length > 0 && (
            <p className="seneca-rule-dialog__hint">
              {fill(t.newFolders.value, { names: answer.newFolders.join(', ') })}
            </p>
          )}
          {answer.truncated && <p className="seneca-rule-dialog__hint">{t.truncated}</p>}
        </>
      )}
    </ModalShell>
  );
}
