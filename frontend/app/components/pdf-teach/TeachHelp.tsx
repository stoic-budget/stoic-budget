'use client';

import ClickAwayListener from '@mui/material/ClickAwayListener';
import MuiTooltip from '@mui/material/Tooltip';
import { useState } from 'react';
import { HelpCircle } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';

/**
 * A "?" beside the Teach button: what teaching does, and where to teach the
 * statement again later (the preview's ⋮ menu), which is not obvious. A mouse
 * opens it by pointing; a tap or a click keeps it open until the next tap or
 * click elsewhere (MUI's own touch opening closed as the finger lifted).
 */
export function TeachHelp(): React.JSX.Element {
  const t = useIntlayer('pdfTeach');
  const [pointed, setPointed] = useState(false);
  const [pinned, setPinned] = useState(false);
  return (
    <ClickAwayListener onClickAway={() => setPinned(false)}>
      <MuiTooltip
        open={pointed || pinned}
        onOpen={() => setPointed(true)}
        onClose={() => setPointed(false)}
        disableTouchListener
        title={
          <span className="seneca-pdf-teach__help-text">
            <span>{t.teachExplain}</span>
            <span>{t.teachAgainWhere}</span>
          </span>
        }
        placement="top"
      >
        <button
          type="button"
          className="seneca-pdf-teach__help"
          aria-label={t.helpLabel.value}
          data-testid="teach-help"
          // Keeps the row from opening the statement.
          onClick={event => {
            event.stopPropagation();
            setPinned(true);
          }}
        >
          <HelpCircle size={14} aria-hidden />
        </button>
      </MuiTooltip>
    </ClickAwayListener>
  );
}
