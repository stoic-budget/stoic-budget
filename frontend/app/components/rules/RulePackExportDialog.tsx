'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Checkbox } from '@/app/components/ui/checkbox';
import { FULL_SCREEN_ON_PHONE, ModalFooter, ModalShell } from '@/app/components/ui/modal-shell';
import { useIntlayer } from '@/app/i18n';
import type { RuleGroup } from '@/app/lib/contracts';
import { sectionsOf } from './rule-folders';
import type { Rule } from './types';
import { useExportRulePack } from './useRulePacks';

/** Picks rules, folder by folder, and saves them as a pack file. Everything starts ticked. */
export function RulePackExportDialog({
  rules,
  folders,
  onClose,
}: {
  rules: Rule[];
  folders: RuleGroup[];
  onClose: () => void;
}) {
  const t = useIntlayer('rulePacks');
  const words = useIntlayer('ruleFolders');
  const cancel = useIntlayer('categorizationRules').dialog.cancel;
  const exporting = useExportRulePack();
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set(rules.map(rule => rule.id)));
  const setMany = (ids: string[], on: boolean) =>
    setPicked(current => {
      const next = new Set(current);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  const box = (ids: string[], label: string) => {
    const count = ids.filter(id => picked.has(id)).length;
    return (
      <Checkbox
        checked={ids.length > 0 && count === ids.length}
        indeterminate={count > 0 && count < ids.length}
        onCheckedChange={on => setMany(ids, on)}
        label={label}
      />
    );
  };

  const download = () =>
    void exporting
      .mutateAsync(rules.filter(rule => picked.has(rule.id)).map(rule => rule.id))
      .then(onClose, () => toast.error(t.exportFailed.value));

  return (
    <ModalShell
      isOpen
      onClose={onClose}
      size="sm"
      title={t.exportTitle}
      paperSx={FULL_SCREEN_ON_PHONE}
      footer={
        <ModalFooter
          onCancel={onClose}
          onConfirm={download}
          cancelText={cancel.value}
          confirmText={t.download.value}
          isConfirmLoading={exporting.isPending}
          isConfirmDisabled={picked.size === 0 || exporting.isPending}
        />
      }
    >
      <p className="seneca-rule-dialog__hint">{t.exportHint}</p>
      <div className="seneca-rule-pack__picker">
        {box(
          rules.map(rule => rule.id),
          t.allRules.value,
        )}
        {sectionsOf(rules, folders)
          .filter(section => section.rules.length > 0)
          .map(({ folder, rules: part }) => (
            <div key={folder?.id ?? 'unfiled'} className="seneca-rule-pack__part">
              {folders.length > 0 &&
                box(
                  part.map(rule => rule.id),
                  folder?.name ?? words.unfiled.value,
                )}
              <div className={folders.length > 0 ? 'seneca-rule-pack__rules' : undefined}>
                {part.map(rule => (
                  <div key={rule.id}>{box([rule.id], rule.name)}</div>
                ))}
              </div>
            </div>
          ))}
      </div>
    </ModalShell>
  );
}
