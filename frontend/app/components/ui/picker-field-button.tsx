'use client';

import { Box, type SxProps, type Theme } from '@mui/material';
import { ChevronDown } from '@/app/components/icons';
import { tokens } from '@/app/lib/theme-tokens';

const HEIGHT = { small: 40, medium: 48, compact: 36 } as const;

export type PickerFieldSize = keyof typeof HEIGHT;

export interface PickerFieldButtonProps {
  /** What is picked, or the placeholder while nothing is. */
  label: string;
  /** Nothing picked: the label reads as a placeholder. */
  empty: boolean;
  onClick: () => void;
  disabled?: boolean;
  id?: string;
  ariaLabel?: string;
  size?: PickerFieldSize;
  sx?: SxProps<Theme>;
}

/**
 * A form field that opens a picker drawer instead of a menu: it looks like the
 * inputs around it, with the pick inside and a chevron on the right.
 */
export function PickerFieldButton({
  label,
  empty,
  onClick,
  disabled = false,
  id,
  ariaLabel,
  size = 'medium',
  sx,
}: PickerFieldButtonProps): React.JSX.Element {
  return (
    <Box
      component="button"
      type="button"
      id={id}
      aria-label={ariaLabel}
      aria-haspopup="dialog"
      title={empty ? undefined : label}
      disabled={disabled}
      onClick={onClick}
      sx={[
        {
          display: 'flex',
          height: HEIGHT[size],
          width: '100%',
          minWidth: 0,
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          border: '1px solid var(--input)',
          borderRadius: tokens.radius.md,
          bgcolor: 'transparent',
          color: empty ? 'var(--text-muted)' : 'text.primary',
          px: 1.75,
          font: 'inherit',
          fontSize: size === 'medium' ? 16 : 14,
          textAlign: 'left',
          cursor: 'pointer',
          '&:hover:not(:disabled)': { borderColor: 'text.primary' },
          '&:focus-visible': {
            borderColor: 'primary.main',
            boxShadow: '0 0 0 3px var(--primary-50)',
            outline: 'none',
          },
          '&:disabled': { cursor: 'default', opacity: 0.6 },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Box
        component="span"
        sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {label}
      </Box>
      <ChevronDown aria-hidden style={{ width: 18, height: 18, flexShrink: 0 }} />
    </Box>
  );
}
