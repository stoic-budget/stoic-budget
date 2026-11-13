'use client';

import { useState } from 'react';
import { TagDrawer } from '@/app/components/tags/TagDrawer';
import { useTags } from '@/app/hooks/useTags';
import type { StorageTag } from '@/app/lib/contracts';
import type { CustomTableCellValue } from '../../utils/types';

interface TagsCellEditorProps {
  value: CustomTableCellValue;
  onChange: (names: string | null) => void;
  onClose: () => void;
}

/** "A, B" → ["A", "B"]: the cell holds tag names as a table filled from transactions writes them. */
export const tagNamesOf = (value: CustomTableCellValue): string[] =>
  typeof value === 'string'
    ? value
        .split(',')
        .map(name => name.trim())
        .filter(Boolean)
    : [];

/**
 * Tag cells: the app's tag drawer opens at once, the workspace's tags with the
 * cell's ones checked. Each click saves the cell; the drawer stays open for
 * more. A name typed in before that is no tag of the workspace stays in the cell.
 */
export function TagsCellEditor({ value, onChange, onClose }: TagsCellEditorProps) {
  const { data: allTags = [] } = useTags();
  // Kept here, so quick clicks build on each other rather than on a save still on its way.
  const [names, setNames] = useState(() => tagNamesOf(value));
  const byName = new Map(allTags.map(tag => [tag.name.toLocaleLowerCase(), tag]));
  const attached = names.flatMap(name => {
    const tag = byName.get(name.toLocaleLowerCase());
    return tag ? [{ id: tag.id, name: tag.name, color: tag.color }] : [];
  });
  const loose = names.filter(name => !byName.has(name.toLocaleLowerCase()));

  const change = (next: StorageTag[]) => {
    const picked = [...next.map(tag => tag.name).sort((a, b) => a.localeCompare(b)), ...loose];
    setNames(picked);
    onChange(picked.length > 0 ? picked.join(', ') : null);
  };

  return <TagDrawer open onClose={onClose} value={attached} onChange={change} />;
}
