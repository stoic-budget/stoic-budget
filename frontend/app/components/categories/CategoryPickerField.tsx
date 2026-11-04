'use client';

import type { SxProps, Theme } from '@mui/material';
import { useState } from 'react';
import StatementCategoryDrawer from '@/app/(main)/statements/[id]/edit/StatementCategoryDrawer';
import { PickerFieldButton, type PickerFieldSize } from '@/app/components/ui/picker-field-button';
import { useLocale } from '@/app/i18n';
import { getCategoryDisplayName, type StatementCategoryNode } from '@/app/lib/statement-categories';

type PickerCategory = StatementCategoryNode & { isEnabled?: boolean };

export interface CategoryPickerFieldProps {
  value: string;
  categories: PickerCategory[];
  onChange: (categoryId: string) => void;
  /** Shown on the field while nothing is picked. */
  placeholder: string;
  /** Adds a first row in the drawer that clears the field, under this name. */
  clearLabel?: string;
  disabled?: boolean;
  id?: string;
  ariaLabel?: string;
  size?: PickerFieldSize;
  sx?: SxProps<Theme>;
}

/**
 * A form field for one category: it looks like the inputs around it and opens
 * the app's category drawer (search, "Create category"). A category created
 * there is picked at once and named here before the caller's list reloads.
 */
export function CategoryPickerField({
  value,
  categories,
  onChange,
  placeholder,
  clearLabel,
  disabled = false,
  id,
  ariaLabel,
  size = 'medium',
  sx,
}: CategoryPickerFieldProps): React.JSX.Element {
  const { locale } = useLocale();
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState<PickerCategory[]>([]);
  const enabled = [
    ...categories.filter(category => category.isEnabled !== false),
    ...created.filter(extra => !categories.some(category => category.id === extra.id)),
  ];
  const selected = enabled.find(category => category.id === value);
  const label = selected ? getCategoryDisplayName(selected, locale) : placeholder;

  return (
    <>
      <PickerFieldButton
        id={id}
        ariaLabel={ariaLabel}
        label={label}
        empty={!selected}
        disabled={disabled}
        onClick={() => setOpen(true)}
        size={size}
        sx={sx}
      />
      {/* Mounted while open only: a page may hold many of these fields. */}
      {open ? (
        <StatementCategoryDrawer
          open
          onClose={() => setOpen(false)}
          categories={enabled}
          selectedCategoryId={value}
          clearLabel={clearLabel}
          onSelect={categoryId => {
            setOpen(false);
            if (categoryId !== value) {
              onChange(categoryId);
            }
          }}
          onCreated={category => {
            setCreated(prev => [...prev, category]);
            setOpen(false);
            onChange(category.id);
          }}
        />
      ) : null}
    </>
  );
}
