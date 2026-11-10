'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { ModalFooter, ModalShell } from '@/app/components/ui/modal-shell';
import { useIntlayer } from '@/app/i18n';
import type { RuleGroup } from '@/app/lib/contracts';
import { fill } from './rule-text';
import { useDeleteRuleFolder, useSaveRuleFolder } from './useRuleFolders';

/** Names a new folder, or renames `folder`. */
export function RuleFolderDialog({
  folder,
  onClose,
}: {
  folder: RuleGroup | null;
  onClose: () => void;
}) {
  const t = useIntlayer('ruleFolders');
  const rules = useIntlayer('categorizationRules');
  const save = useSaveRuleFolder();
  const [name, setName] = useState(folder?.name ?? '');
  const blank = name.trim() === '';

  const submit = () => {
    if (blank || save.isPending) {
      return;
    }
    void save
      .mutateAsync({ id: folder?.id ?? null, name: name.trim() })
      .then(onClose, () => toast.error(t.saveFailed.value));
  };

  return (
    <ModalShell
      isOpen
      onClose={onClose}
      size="sm"
      title={folder ? t.renameTitle : t.newFolder}
      footer={
        <ModalFooter
          onCancel={onClose}
          onConfirm={submit}
          cancelText={rules.dialog.cancel.value}
          confirmText={t.save.value}
          isConfirmLoading={save.isPending}
          isConfirmDisabled={blank || save.isPending}
        />
      }
    >
      <form
        className="seneca-rule-dialog"
        onSubmit={event => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="seneca-rule-dialog__field">
          <label htmlFor="rule-folder-name" className="seneca-rule-dialog__label">
            {t.nameLabel}
          </label>
          <input
            id="rule-folder-name"
            className="seneca-rule-dialog__input"
            value={name}
            maxLength={100}
            // biome-ignore lint/a11y/noAutofocus: the dialog is opened to type this name
            autoFocus
            onChange={event => setName(event.target.value)}
          />
        </div>
      </form>
    </ModalShell>
  );
}

/** Asks before deleting `folder`; its rules stay, outside any folder. */
export function RuleFolderDeleteDialog({
  folder,
  onClose,
}: {
  folder: RuleGroup;
  onClose: () => void;
}) {
  const t = useIntlayer('ruleFolders');
  const rules = useIntlayer('categorizationRules');
  const remove = useDeleteRuleFolder();

  return (
    <ModalShell
      isOpen
      onClose={onClose}
      size="sm"
      title={t.delete}
      footer={
        <ModalFooter
          onCancel={onClose}
          onConfirm={() =>
            void remove
              .mutateAsync(folder.id)
              .then(onClose, () => toast.error(t.deleteFailed.value))
          }
          cancelText={rules.dialog.cancel.value}
          confirmText={t.delete.value}
          confirmVariant="destructive"
          isConfirmLoading={remove.isPending}
          isConfirmDisabled={remove.isPending}
        />
      }
    >
      <p className="seneca-rule-dialog__hint">
        {fill(t.deleteConfirm.value, { name: folder.name })}
      </p>
    </ModalShell>
  );
}
