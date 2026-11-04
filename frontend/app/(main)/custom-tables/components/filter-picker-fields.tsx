'use client';

import { useState } from 'react';
import StatementCategoryDrawer from '@/app/(main)/statements/[id]/edit/StatementCategoryDrawer';
import { CurrencyDrawer } from '@/app/components/receipts/components/CurrencyDrawer';
import { PickerFieldButton } from '@/app/components/ui/picker-field-button';
import { useCurrencyPickerState } from '@/app/hooks/useCurrencyPickerState';
import { useCategoryName } from '@/app/lib/use-category-name';
import type { TableCategory } from '../hooks/useTablesList';

/** Past this many picks the field counts them instead of naming them. */
const MAX_INLINE = 2;

interface CurrencyFilterFieldProps {
  label: string;
  value: string;
  onChange: (currency: string) => void;
  /** The "no filter" row and the field's text while nothing is picked. */
  anyLabel: string;
}

/** Mounted while open only: the picker state starts fresh each time. */
function CurrencyFilterDrawer({
  value,
  onChange,
  anyLabel,
  onClose,
}: Omit<CurrencyFilterFieldProps, 'label'> & { onClose: () => void }) {
  const picker = useCurrencyPickerState(value);
  const pick = (code: string) => {
    onChange(code);
    if (code) picker.pushRecentCurrency(code);
    onClose();
  };
  return (
    <CurrencyDrawer
      isOpen
      onClose={onClose}
      currencySearch={picker.currencySearch}
      setCurrencySearch={picker.setCurrencySearch}
      selectedCurrencyItem={picker.selectedCurrencyItem}
      selectedMatchesSearch={picker.selectedMatchesSearch}
      currencyQuery={picker.currencyQuery}
      recentCurrencyItems={picker.recentCurrencyItems}
      allCurrencyItems={picker.allCurrencyItems}
      handleSelectCurrency={pick}
      noneOption={{ label: anyLabel, selected: !value, onSelect: () => pick('') }}
    />
  );
}

/** The currency filter: the app's currency drawer, with "Any" first. */
export function CurrencyFilterField({
  label,
  value,
  onChange,
  anyLabel,
}: CurrencyFilterFieldProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <PickerFieldButton
        ariaLabel={label}
        label={value || anyLabel}
        empty={!value}
        onClick={() => setOpen(true)}
        size="compact"
      />
      {open ? (
        <CurrencyFilterDrawer
          value={value}
          onChange={onChange}
          anyLabel={anyLabel}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

interface CategoriesFilterFieldProps {
  label: string;
  value: string[];
  categories: TableCategory[];
  onChange: (categoryIds: string[]) => void;
  anyLabel: string;
  /** Shown on the field while the workspace has no categories. */
  emptyLabel: string;
  /** Summary for three or more picks; `{{count}}` is replaced. */
  selectedLabel: string;
}

/**
 * The categories filter: the app's category drawer with a tick on each pick.
 * It stays open while categories are toggled; "Any" clears them and closes it.
 */
export function CategoriesFilterField(props: CategoriesFilterFieldProps) {
  const { label, value, categories, onChange, anyLabel, emptyLabel, selectedLabel } = props;
  const [open, setOpen] = useState(false);
  const categoryName = useCategoryName();
  const nameOf = (id: string) => {
    const category = categories.find(item => item.id === id);
    return category ? categoryName(category.name) : id;
  };
  let text = anyLabel;
  if (!categories.length) text = emptyLabel;
  else if (value.length > MAX_INLINE)
    text = selectedLabel.replace('{{count}}', String(value.length));
  else if (value.length) text = value.map(nameOf).join(', ');

  const toggle = (id: string) => {
    if (!id) {
      onChange([]);
      setOpen(false);
      return;
    }
    onChange(value.includes(id) ? value.filter(item => item !== id) : [...value, id]);
  };
  return (
    <>
      <PickerFieldButton
        ariaLabel={label}
        label={text}
        empty={value.length === 0}
        disabled={!categories.length}
        onClick={() => setOpen(true)}
        size="compact"
      />
      {open ? (
        <StatementCategoryDrawer
          open
          onClose={() => setOpen(false)}
          categories={categories}
          selectedCategoryIds={value}
          clearLabel={anyLabel}
          onSelect={toggle}
          onCreated={category => onChange([...value, category.id])}
        />
      ) : null}
    </>
  );
}
