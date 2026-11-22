'use client';

import { Button } from '@mui/material';
import { useState } from 'react';
import { DrawerShell } from '@/app/components/ui/drawer-shell';
import { Input } from '@/app/components/ui/input';
import { useIntlayer } from '@/app/i18n';

/** The single-row comment field takes 1000 characters; the bulk one matches it. */
const MAX_COMMENT = 1000;

/**
 * One comment for every ticked row, in the right-hand drawer the tag form
 * uses. The text is added after what a row already says, never instead of it.
 */
export function BulkCommentDrawer({
  open,
  onClose,
  onSubmit,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  /** Sends the trimmed text; true when it was saved, so the field can be emptied. */
  onSubmit: (note: string) => Promise<boolean>;
  saving: boolean;
}): React.JSX.Element {
  const t = useIntlayer('allTransactionsBulk');
  const tTags = useIntlayer('tagsPage');
  const [text, setText] = useState('');
  const note = text.trim();
  const close = () => {
    setText('');
    onClose();
  };
  const submit = () => {
    if (note && !saving) {
      void onSubmit(note).then(saved => saved && setText(''));
    }
  };

  return (
    <DrawerShell
      isOpen={open}
      onClose={close}
      width="md"
      title={<span style={{ fontWeight: 500 }}>{t.addComment}</span>}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button
            type="button"
            variant="text"
            onClick={close}
            sx={{ color: 'var(--text-muted)', fontWeight: 500 }}
          >
            {tTags.dialog.cancel}
          </Button>
          <Button
            type="button"
            variant={note ? 'contained' : 'outlined'}
            onClick={submit}
            disabled={!note || saving}
          >
            {t.addToSelected}
          </Button>
        </div>
      }
    >
      <form
        className="seneca-tag-dialog"
        onSubmit={event => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="seneca-tag-dialog__field">
          <label htmlFor="bulk-comment" className="seneca-tag-dialog__label">
            {t.addComment}
          </label>
          <Input
            id="bulk-comment"
            autoFocus
            maxLength={MAX_COMMENT}
            value={text}
            onChange={event => setText(event.target.value)}
          />
          <span className="seneca-tag-dialog__optional">{t.commentHint}</span>
        </div>
      </form>
    </DrawerShell>
  );
}
