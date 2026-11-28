'use client';

import ClickAwayListener from '@mui/material/ClickAwayListener';
import Popper from '@mui/material/Popper';
import { useVirtualizer } from '@tanstack/react-virtual';
import { type KeyboardEvent, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';
import { iconComponentFor } from '@/app/lib/icons/icon-component';
import { iconName, iconValue } from '@/app/lib/icons/icon-value';
import { useIconSearch } from './useIconSearch';

const ROW = 40;
/** The row that stands for "no icon"; never an icon name, which has no spaces. */
const NONE = ' none';

export interface IconPickerProps {
  /** The stored value: `lucide:<name>`, a legacy `mdi:*`, or null for none. */
  value: string | null;
  onChange: (value: string | null) => void;
  /** Offer "No icon" as the first row. */
  allowNone?: boolean;
  /** Id of the visible label, for the field's accessible name. */
  labelledBy?: string;
}

/**
 * A field that finds an icon among the whole Lucide set by typing: by its
 * English name or search words, its name in the user's language where the
 * app has one, or a word of a group ("еда", "смартфон", "casino"). The list
 * under it is virtual, so all two thousand icons scroll smoothly.
 */
export function IconPicker({ value, onChange, allowNone = false, labelledBy }: IconPickerProps) {
  const t = useIntlayer('iconPicker');
  const listId = useId();
  const anchorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const { results, loading, failed, labelOf } = useIconSearch(open, query);

  const current = iconName(value);
  const rows = allowNone && !query.trim() ? [NONE, ...results] : results;
  const virtualizer = useVirtualizer({
    count: open ? rows.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW,
    overscan: 8,
  });

  const close = () => {
    setOpen(false);
    setQuery('');
  };
  const pick = (row: string) => {
    onChange(row === NONE ? null : iconValue(row));
    close();
    inputRef.current?.blur();
  };
  const move = (step: number) => {
    if (rows.length === 0) {
      return;
    }
    const next = Math.min(Math.max(active + step, 0), rows.length - 1);
    setActive(next);
    virtualizer.scrollToIndex(next);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      move(event.key === 'ArrowDown' ? 1 : -1);
    } else if (event.key === 'Enter' && open && rows[active]) {
      event.preventDefault();
      pick(rows[active]);
    } else if (event.key === 'Escape' && open) {
      // Close the list, not the dialog around the picker.
      event.stopPropagation();
      close();
    } else if (event.key === 'Tab') {
      close();
    }
  };

  const CurrentIcon = current ? iconComponentFor(current) : null;
  const status = failed
    ? t.failed
    : loading
      ? t.loading
      : rows.length === 0
        ? t.nothingFound
        : null;

  return (
    <ClickAwayListener onClickAway={() => open && close()}>
      <div className="seneca-icon-picker">
        <div className="seneca-icon-picker__field" ref={anchorRef}>
          <span className="seneca-icon-picker__current" aria-hidden="true">
            {CurrentIcon ? (
              <CurrentIcon size={18} />
            ) : (
              <span className="seneca-icon-picker__none" />
            )}
          </span>
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-labelledby={labelledBy}
            aria-activedescendant={open && rows[active] ? `${listId}-${active}` : undefined}
            value={open ? query : current ? labelOf(current) : t.noIcon.value}
            placeholder={t.search.value}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            onChange={event => {
              // A new query starts at its best match.
              setQuery(event.target.value);
              setActive(0);
              setOpen(true);
            }}
            onKeyDown={onKeyDown}
          />
          <ChevronDown size={16} aria-hidden="true" />
        </div>
        <Popper
          open={open}
          anchorEl={anchorRef.current}
          placement="bottom-start"
          className="seneca-icon-picker__popper"
          style={{ width: anchorRef.current?.offsetWidth }}
        >
          <div
            ref={scrollRef}
            id={listId}
            role="listbox"
            aria-labelledby={labelledBy}
            className="seneca-icon-picker__list"
          >
            {status ? (
              <p className="seneca-icon-picker__status">{status}</p>
            ) : (
              <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
                {virtualizer.getVirtualItems().map(item => {
                  const row = rows[item.index];
                  const Icon = row === NONE ? null : iconComponentFor(row);
                  const selected = row === NONE ? !current : row === current;
                  return (
                    <div
                      key={row}
                      id={`${listId}-${item.index}`}
                      role="option"
                      // The field keeps the focus and points at the row (aria-activedescendant).
                      tabIndex={-1}
                      aria-selected={selected}
                      data-active={item.index === active || undefined}
                      className="seneca-icon-picker__option"
                      style={{ transform: `translateY(${item.start}px)`, height: ROW }}
                      // Keep the focus in the field while a row is clicked.
                      onMouseDown={event => event.preventDefault()}
                      onMouseEnter={() => setActive(item.index)}
                      onClick={() => pick(row)}
                    >
                      {Icon ? <Icon size={20} /> : <span className="seneca-icon-picker__none" />}
                      <span className="seneca-icon-picker__name">
                        {row === NONE ? t.noIcon : labelOf(row)}
                      </span>
                      {selected && <Check size={16} aria-hidden="true" />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Popper>
      </div>
    </ClickAwayListener>
  );
}
