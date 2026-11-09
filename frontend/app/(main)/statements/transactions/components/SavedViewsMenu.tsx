'use client';

import OutlinedInput from '@mui/material/OutlinedInput';
import Popover from '@mui/material/Popover';
import { useId, useRef, useState } from 'react';
import { Bookmark, BookmarkOutline, Check, Pencil, Trash2 } from '@/app/components/icons';
import { Button } from '@/app/components/ui/button';
import { useIntlayer } from '@/app/i18n';
import { MAX_VIEW_NAME, type SavedView, viewFilters } from '../saved-views';
import { filtersKey, type TransactionFilters } from '../transaction-filters';
import { useSavedViews } from '../use-saved-views';

const nameInputSx = { fontSize: 14, height: 36, flex: 1, backgroundColor: 'var(--card-bg)' };

/**
 * Named filter sets: apply one, save the filters in force under a name,
 * rename or delete. Kept per person in the page's view preference.
 */
export function SavedViewsMenu({
  filters,
  onApply,
}: {
  filters: TransactionFilters;
  onApply: (filters: TransactionFilters) => void;
}): React.JSX.Element {
  const t = useIntlayer('allTransactionsFilters');
  const { views, ready, failed, saveView, renameView, removeView } = useSavedViews();
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const current = filtersKey(filters);
  const active = views.find(view => view.filters === current && current !== '');

  const apply = (view: SavedView) => {
    onApply(viewFilters(view));
    setOpen(false);
  };
  const commitRename = () => {
    if (editing) {
      renameView(editing.id, editing.name);
      setEditing(null);
    }
  };

  return (
    <>
      <Button
        ref={anchorRef}
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {active ? <Bookmark size={16} aria-hidden /> : <BookmarkOutline size={16} aria-hidden />}
        {active?.name ?? t.savedViews}
      </Button>
      <Popover
        open={open}
        anchorEl={anchorRef.current}
        onClose={() => {
          setOpen(false);
          setEditing(null);
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            role: 'dialog',
            'aria-labelledby': titleId,
            className: 'seneca-all-tx__views',
          },
        }}
      >
        <span id={titleId} className="seneca-all-tx__card-title">
          {t.savedViews}
        </span>
        {views.length === 0 ? (
          <p className="seneca-all-tx__muted seneca-all-tx__views-empty">
            {failed ? t.savedViewsUnavailable : t.noSavedViews}
          </p>
        ) : (
          <ul className="seneca-all-tx__views-list">
            {views.map(view =>
              editing?.id === view.id ? (
                <li key={view.id} className="seneca-all-tx__views-row">
                  <form
                    className="seneca-all-tx__views-form"
                    onSubmit={event => {
                      event.preventDefault();
                      commitRename();
                    }}
                  >
                    <OutlinedInput
                      autoFocus
                      size="small"
                      value={editing.name}
                      onChange={event => setEditing({ id: view.id, name: event.target.value })}
                      inputProps={{ 'aria-label': t.viewName.value, maxLength: MAX_VIEW_NAME }}
                      sx={nameInputSx}
                    />
                    <button
                      type="submit"
                      className="seneca-all-tx__icon-button"
                      aria-label={t.rename.value}
                    >
                      <Check size={16} aria-hidden />
                    </button>
                  </form>
                </li>
              ) : (
                <li key={view.id} className="seneca-all-tx__views-row">
                  <button
                    type="button"
                    className="seneca-all-tx__views-name"
                    aria-current={view.id === active?.id ? 'true' : undefined}
                    onClick={() => apply(view)}
                  >
                    {view.name}
                  </button>
                  <button
                    type="button"
                    className="seneca-all-tx__icon-button"
                    aria-label={`${t.rename.value}: ${view.name}`}
                    onClick={() => setEditing({ id: view.id, name: view.name })}
                  >
                    <Pencil size={16} aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="seneca-all-tx__icon-button"
                    aria-label={`${t.remove.value}: ${view.name}`}
                    onClick={() => removeView(view.id)}
                  >
                    <Trash2 size={16} aria-hidden />
                  </button>
                </li>
              ),
            )}
          </ul>
        )}
        <form
          className="seneca-all-tx__views-form seneca-all-tx__views-save"
          onSubmit={event => {
            event.preventDefault();
            saveView(name, filters);
            setName('');
          }}
        >
          <OutlinedInput
            size="small"
            value={name}
            placeholder={t.viewName.value}
            onChange={event => setName(event.target.value)}
            inputProps={{ 'aria-label': t.viewName.value, maxLength: MAX_VIEW_NAME }}
            sx={nameInputSx}
          />
          <Button type="submit" size="sm" disabled={!ready || !name.trim() || current === ''}>
            {t.saveView}
          </Button>
        </form>
      </Popover>
    </>
  );
}
