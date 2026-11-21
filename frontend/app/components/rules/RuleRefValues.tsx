'use client';

import { useState } from 'react';
import { Plus, Tag, X } from '@/app/components/icons';
import { PayeeDrawer } from '@/app/components/payees/PayeeDrawer';
import { usePayee } from '@/app/components/payees/usePayees';
import { TagDrawer } from '@/app/components/tags/TagDrawer';
import { useTags } from '@/app/hooks/useTags';
import { useIntlayer } from '@/app/i18n';
import type { StorageTag } from '@/app/lib/contracts';
import { fill } from './rule-text';

/** A chip with a button that takes it away. */
function Chip({ label, onRemove, icon }: { label: string; onRemove: () => void; icon?: boolean }) {
  const t = useIntlayer('categorizationRules');
  return (
    <span className="seneca-tag-picker__chip">
      {icon && <Tag size={14} color="var(--text-muted)" aria-hidden />}
      {label}
      <button
        type="button"
        className="seneca-tag-picker__remove"
        aria-label={fill(t.dialog.removeValue.value, { value: label })}
        onClick={onRemove}
      >
        <X size={12} aria-hidden />
      </button>
    </span>
  );
}

/** The payee a condition asks about: one of the workspace's, picked in the payee drawer. */
export function RulePayeeValue({
  payeeId,
  onChange,
}: {
  payeeId: string;
  onChange: (payeeId: string) => void;
}) {
  const t = useIntlayer('categorizationRules');
  const [choosing, setChoosing] = useState(false);
  const stored = usePayee(payeeId || null).data;

  return (
    <div className="seneca-rule-values">
      {payeeId && <Chip label={stored?.name ?? '…'} onRemove={() => onChange('')} />}
      <button type="button" className="seneca-tag-picker__add" onClick={() => setChoosing(true)}>
        {t.dialog.pickPayee}
      </button>
      <PayeeDrawer
        open={choosing}
        title={t.dialog.pickPayee.value}
        current={stored ? { id: stored.id, name: stored.name } : null}
        // A condition asks about a payee that exists: no "Create" row.
        existingOnly
        onClose={() => setChoosing(false)}
        onPick={choice => {
          setChoosing(false);
          if ('payeeId' in choice) {
            onChange(choice.payeeId);
          }
        }}
      />
    </div>
  );
}

/** The tags a condition asks about, picked in the tag drawer: any of them, or none. */
export function RuleTagsValue({
  tagIds,
  onChange,
}: {
  tagIds: string[];
  onChange: (tagIds: string[]) => void;
}) {
  const t = useIntlayer('tagsPage');
  const [open, setOpen] = useState(false);
  const tags = useTags().data ?? [];
  const chosen: StorageTag[] = tags.filter(tag => tagIds.includes(tag.id));

  return (
    <div className="seneca-rule-values">
      {chosen.map(tag => (
        <Chip
          key={tag.id}
          label={tag.name}
          icon
          onRemove={() => onChange(tagIds.filter(id => id !== tag.id))}
        />
      ))}
      <button type="button" className="seneca-tag-picker__add" onClick={() => setOpen(true)}>
        <Plus size={14} aria-hidden />
        {t.picker.add}
      </button>
      <TagDrawer
        open={open}
        onClose={() => setOpen(false)}
        value={chosen}
        onChange={next => onChange(next.map(tag => tag.id))}
      />
    </div>
  );
}
