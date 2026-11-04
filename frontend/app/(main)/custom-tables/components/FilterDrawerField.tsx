'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import { Check, ChevronLeft, Search } from '@/app/components/icons';
import { DrawerShell } from '@/app/components/ui/drawer-shell';
import { PickerFieldButton } from '@/app/components/ui/picker-field-button';

export interface FilterDrawerOption {
  value: string;
  label: string;
  /** A second, quieter line: a statement's period. */
  description?: string;
  /** Drawn before the label: a document's thumbnail. */
  leading?: ReactNode;
}

export interface FilterDrawerLabels {
  any: string;
  /** Summary for three or more picks; `{{count}}` is replaced. */
  selected: string;
  search: string;
  noMatches: string;
}

/** Past this many options the drawer gets a search box. */
const SEARCH_FROM = 8;
const MAX_INLINE = 2;

interface FilterDrawerFieldProps {
  /** The field's name, and the drawer's title. */
  label: string;
  options: FilterDrawerOption[];
  value: string[];
  onChange: (value: string[]) => void;
  /** Several picks, the drawer staying open; otherwise one, and it closes. */
  multiple?: boolean;
  /** Shown on the field instead of "Any" while there is nothing to pick from. */
  emptyLabel?: string;
  labels: FilterDrawerLabels;
}

function summary(value: string[], options: FilterDrawerOption[], labels: FilterDrawerLabels) {
  if (value.length === 0) return labels.any;
  if (value.length > MAX_INLINE) return labels.selected.replace('{{count}}', String(value.length));
  return value.map(item => options.find(option => option.value === item)?.label ?? item).join(', ');
}

/**
 * A filter of the new-table dialog: a field like the others that opens the
 * app's right-hand picker drawer, with "Any" first and a tick on each pick.
 */
export function FilterDrawerField(props: FilterDrawerFieldProps): React.JSX.Element {
  const { label, options, value, onChange, multiple = false, emptyLabel, labels } = props;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const disabled = options.length === 0;
  const needle = query.trim().toLowerCase();
  const shown = needle
    ? options.filter(option =>
        `${option.label} ${option.description ?? ''}`.toLowerCase().includes(needle),
      )
    : options;

  const close = () => {
    setOpen(false);
    setQuery('');
  };
  const pick = (next: string) => {
    if (!multiple) {
      onChange(next ? [next] : []);
      close();
      return;
    }
    if (!next) onChange([]);
    else onChange(value.includes(next) ? value.filter(item => item !== next) : [...value, next]);
  };
  const row = (key: string, text: ReactNode, selected: boolean, leading?: ReactNode) => (
    <button
      key={key}
      type="button"
      aria-pressed={selected}
      onClick={() => pick(key)}
      className={`seneca-cat-drawer__option${selected ? ' seneca-cat-drawer__option--selected' : ''}`}
    >
      {leading}
      <span className="seneca-cat-drawer__option-name">{text}</span>
      {selected ? <Check size={18} color="var(--primary)" aria-hidden /> : null}
    </button>
  );

  return (
    <>
      <PickerFieldButton
        ariaLabel={label}
        label={disabled && emptyLabel ? emptyLabel : summary(value, options, labels)}
        empty={value.length === 0}
        disabled={disabled}
        onClick={() => setOpen(true)}
        size="compact"
      />
      {/* Mounted while open only: the dialog holds several of these fields. */}
      {open ? (
        <DrawerShell
          isOpen
          onClose={close}
          position="right"
          width="sm"
          showCloseButton={false}
          className="bg-card border-l-0"
          title={
            <div className="seneca-payable-drawer__title-wrap">
              <button
                type="button"
                onClick={close}
                className="seneca-col-drawer__back-btn"
                aria-label={label}
              >
                <ChevronLeft size={20} />
              </button>
              <span style={{ fontSize: 18, fontWeight: 600 }}>{label}</span>
            </div>
          }
        >
          <div className="seneca-cat-drawer">
            {options.length >= SEARCH_FROM ? (
              <div className="seneca-cat-drawer__search">
                <label className="seneca-cat-drawer__search-label">
                  <Search size={18} className="seneca-cat-drawer__search-icon" />
                  <input
                    type="text"
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    placeholder={labels.search}
                    aria-label={labels.search}
                    className="seneca-cat-drawer__search-input"
                  />
                </label>
              </div>
            ) : null}
            <div className="seneca-cat-drawer__list">
              {needle ? null : row('', labels.any, value.length === 0)}
              {shown.length === 0 ? (
                <div className="seneca-cat-drawer__no-results">{labels.noMatches}</div>
              ) : (
                shown.map(option =>
                  row(
                    option.value,
                    <>
                      {option.label}
                      {option.description ? (
                        <span className="seneca-cat-drawer__option-desc">{option.description}</span>
                      ) : null}
                    </>,
                    value.includes(option.value),
                    option.leading,
                  ),
                )
              )}
            </div>
          </div>
        </DrawerShell>
      ) : null}
    </>
  );
}
