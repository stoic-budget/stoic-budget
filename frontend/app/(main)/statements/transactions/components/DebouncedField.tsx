'use client';

import OutlinedInput from '@mui/material/OutlinedInput';
import { type ReactNode, useEffect, useState } from 'react';

export const FILTER_DEBOUNCE_MS = 350;

interface DebouncedFieldProps {
  /** The value in force (from the URL). */
  value: string;
  /** What a draft commits as: trimmed text, a parsed number. */
  normalize: (draft: string) => string;
  onCommit: (value: string) => void;
  label: string;
  type?: 'search' | 'text';
  inputMode?: 'decimal' | 'text';
  startAdornment?: ReactNode;
  width?: number | string;
}

/**
 * A filter field that commits a pause after the last keystroke, so the list is
 * asked once per thought rather than once per letter. A value set from
 * elsewhere (clear all, a saved view) replaces the draft; the draft's own
 * commit does not, so a trailing space survives while typing.
 */
export function DebouncedField({
  value,
  normalize,
  onCommit,
  label,
  type = 'text',
  inputMode = 'text',
  startAdornment,
  width,
}: DebouncedFieldProps): React.JSX.Element {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    if (normalize(draft) !== value) {
      setDraft(value);
    }
  }

  useEffect(() => {
    const next = normalize(draft);
    if (next === value) {
      return;
    }
    const timer = setTimeout(() => onCommit(next), FILTER_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, value, normalize, onCommit]);

  return (
    <OutlinedInput
      size="small"
      type={type}
      value={draft}
      placeholder={label}
      onChange={event => setDraft(event.target.value)}
      startAdornment={startAdornment}
      inputProps={{ 'aria-label': label, inputMode }}
      sx={{ width, fontSize: 14, height: 36, backgroundColor: 'var(--card-bg)' }}
    />
  );
}
