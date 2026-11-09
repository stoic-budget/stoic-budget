'use client';

import { useState } from 'react';
import { TagDrawer } from '@/app/components/tags/TagDrawer';
import { PickerFieldButton } from '@/app/components/ui/picker-field-button';
import type { TagList } from '@/app/lib/contracts';

/** Past this many picks the field counts them instead of naming them. */
const MAX_INLINE = 2;

interface TagsFilterFieldProps {
  label: string;
  value: string[];
  tags: TagList;
  onChange: (tagIds: string[]) => void;
  anyLabel: string;
  /** Summary for three or more picks; `{{count}}` is replaced. */
  selectedLabel: string;
}

/** The tags filter: the app's tag drawer with a tick on each pick, like the categories one. */
export function TagsFilterField({
  label,
  value,
  tags,
  onChange,
  anyLabel,
  selectedLabel,
}: TagsFilterFieldProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const picked = value.flatMap(id => {
    const tag = tags.find(item => item.id === id);
    return tag ? [{ id: tag.id, name: tag.name, color: tag.color }] : [];
  });
  // A tag the list lacks (deleted, or a link from another workspace) still narrows
  // the rows, so it shows by its id, as the categories field does; the next pick drops it.
  const nameOf = (id: string) => picked.find(tag => tag.id === id)?.name ?? id;
  let text = anyLabel;
  if (value.length > MAX_INLINE) {
    text = selectedLabel.replace('{{count}}', String(value.length));
  } else if (value.length) {
    text = value.map(nameOf).join(', ');
  }
  return (
    <>
      <PickerFieldButton
        ariaLabel={label}
        label={text}
        empty={value.length === 0}
        disabled={!tags.length}
        onClick={() => setOpen(true)}
        size="compact"
      />
      {open ? (
        <TagDrawer
          open
          onClose={() => setOpen(false)}
          value={picked}
          onChange={next => onChange(next.map(tag => tag.id))}
        />
      ) : null}
    </>
  );
}
