'use client';

import { type ReactNode, useState } from 'react';
import type { CustomTableCellValue, CustomTableColumn } from '../../utils/types';
import { CategoryCellEditor } from './CategoryCellEditor';
import { CurrencyCodeEditor } from './CurrencyCodeEditor';
import { isCategoryColumn, isCurrencyCodeColumn, isTagsColumn } from './formatCell';
import { TagsCellEditor } from './TagsCellEditor';

interface PickerProps {
  value: CustomTableCellValue;
  clearLabel: string;
  onChange: (next: string | null) => void;
  onClose: () => void;
}

/** The drawer a column's values are picked from (categories, currencies, tags), or null for typed-in ones. */
export function cellPickerFor(column: CustomTableColumn): React.ComponentType<PickerProps> | null {
  if (isCategoryColumn(column)) return CategoryCellEditor;
  if (isCurrencyCodeColumn(column)) return CurrencyCodeEditor;
  if (isTagsColumn(column)) return TagsCellEditor;
  return null;
}

/**
 * A cell whose value comes from one of the app's drawers rather than typing.
 * The hook decides which drawer the column gets, keeps it open or closed and
 * hands a pick to `onChange`; the cell calls `open` on a click and renders
 * `drawer` beside its value, which stays on show while the drawer is open.
 * A new kind of picked value is one more line in `cellPickerFor`.
 */
export function useCellPicker({
  column,
  value,
  clearLabel,
  onChange,
}: Omit<PickerProps, 'onClose'> & { column: CustomTableColumn }): {
  available: boolean;
  open: () => void;
  drawer: ReactNode;
} {
  const [isOpen, setIsOpen] = useState(false);
  const Picker = cellPickerFor(column);
  return {
    available: Picker !== null,
    open: () => setIsOpen(true),
    drawer:
      Picker && isOpen ? (
        <Picker
          value={value}
          clearLabel={clearLabel}
          onChange={onChange}
          onClose={() => setIsOpen(false)}
        />
      ) : null,
  };
}
