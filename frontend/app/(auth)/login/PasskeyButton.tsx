'use client';

import FingerprintIcon from '@mui/icons-material/FingerprintOutlined';
import Button from '@mui/material/Button';
import type React from 'react';

type Props = { label: string; disabled: boolean; onClick: () => void };

/** The quiet second button of the sign-in form: the browser's passkey prompt. */
export function PasskeyButton({ label, disabled, onClick }: Props): React.JSX.Element {
  return (
    <Button
      type="button"
      fullWidth
      variant="outlined"
      size="large"
      className="seneca-auth-secondary"
      startIcon={<FingerprintIcon />}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}
