'use client';

import type { SxProps, Theme } from '@mui/material';
import MuiButton from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import * as React from 'react';
import { DemoNotice } from '@/app/components/demo/DemoNotice';
import { X } from '@/app/components/icons';
import { Spinner } from '@/app/components/ui/spinner';
import { useIntlayer } from '@/app/i18n';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface ModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  size?: ModalSize;
  children: React.ReactNode;
  footer?: React.ReactNode;
  showCloseButton?: boolean;
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
  paperSx?: SxProps<Theme>;
  contentSx?: SxProps<Theme>;
  className?: string;
  contentClassName?: string;
  /** On a demo server, say above the content that nothing here is saved. Off for dialogs that only show or pick. */
  demoNotice?: boolean;
}

export interface ModalFooterProps {
  onCancel?: () => void;
  onConfirm?: () => void;
  cancelText?: string;
  confirmText?: string;
  /** `quiet-destructive`: a terracotta text button, for an undo-like action that should not shout. */
  confirmVariant?: ConfirmVariant;
  isConfirmLoading?: boolean;
  isConfirmDisabled?: boolean;
  children?: React.ReactNode;
}

const sizeToMaxWidth: Record<ModalSize, 'sm' | 'md' | 'lg' | 'xl' | false> = {
  sm: 'sm',
  md: 'md',
  lg: 'lg',
  xl: 'xl',
  full: false,
};

/** Spread into `paperSx` for a dialog that takes the whole screen on a phone. */
export const FULL_SCREEN_ON_PHONE = {
  '@media (max-width: 1023px)': {
    m: 0,
    width: '100%',
    maxWidth: '100%',
    height: '100%',
    maxHeight: '100%',
    borderRadius: 0,
  },
} as const;

type ConfirmVariant = 'primary' | 'destructive' | 'quiet-destructive';

const CONFIRM_COLOR: Record<ConfirmVariant, 'primary' | 'error' | undefined> = {
  primary: 'primary',
  destructive: 'error',
  'quiet-destructive': undefined,
};

const QUIET_DESTRUCTIVE_SX = {
  color: 'var(--money-down)',
  fontWeight: 500,
  '&:hover': { bgcolor: 'var(--surface-soft)' },
} as const;

function TitleBar(props: {
  title?: React.ReactNode;
  showClose: boolean;
  onClose: () => void;
}): React.JSX.Element {
  const t = useIntlayer('uiShell');
  return (
    <DialogTitle
      id="modal-title"
      sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2 }}
    >
      {props.title}
      {props.showClose && (
        <IconButton
          type="button"
          onClick={props.onClose}
          aria-label={t.closeModal.value}
          size="small"
          sx={{ ml: 'auto' }}
        >
          <X size={20} />
        </IconButton>
      )}
    </DialogTitle>
  );
}

function FooterBar(props: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        padding: '16px 20px',
        borderTop: '1px solid',
        borderColor: 'rgba(0,0,0,0.12)',
        gap: 12,
      }}
    >
      {props.children}
    </div>
  );
}

function makeCloseHandler(onClose: () => void, backdrop: boolean, escape: boolean) {
  return (_e: object, reason: 'backdropClick' | 'escapeKeyDown'): void => {
    if (reason === 'backdropClick' && !backdrop) return;
    if (reason === 'escapeKeyDown' && !escape) return;
    onClose();
  };
}

function renderPaperProps(className?: string, paperSx?: SxProps<Theme>): object {
  return { className, ...(paperSx ? { sx: paperSx } : {}) };
}

/** Unified modal wrapper with backdrop, keyboard (ESC) support, and focus management. */
export function ModalShell({
  isOpen,
  onClose,
  title,
  size = 'md',
  children,
  footer,
  showCloseButton = true,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  paperSx,
  contentSx,
  className,
  contentClassName,
  demoNotice = true,
}: ModalShellProps): React.JSX.Element {
  const handleClose = makeCloseHandler(onClose, closeOnBackdropClick, closeOnEscape);
  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      maxWidth={sizeToMaxWidth[size]}
      fullWidth
      fullScreen={size === 'full'}
      slotProps={{
        backdrop: { sx: { backgroundColor: 'var(--modal-backdrop)' } },
        paper: renderPaperProps(className, paperSx),
      }}
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      {(title || showCloseButton) && (
        <TitleBar title={title} showClose={showCloseButton} onClose={onClose} />
      )}
      <DialogContent className={contentClassName} sx={contentSx}>
        {demoNotice && <DemoNotice />}
        {children}
      </DialogContent>
      {footer && <FooterBar>{footer}</FooterBar>}
    </Dialog>
  );
}

/** Optional component for custom modal headers. */
export function ModalHeader(props: {
  children: React.ReactNode;
  className?: string;
}): React.JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }} className={props.className}>
      {props.children}
    </div>
  );
}

function ConfirmBtn(props: {
  onConfirm: () => void;
  text: string;
  variant: ConfirmVariant;
  loading: boolean;
  disabled: boolean;
}): React.JSX.Element {
  const quiet = props.variant === 'quiet-destructive';
  return (
    <MuiButton
      type="button"
      onClick={props.onConfirm}
      disabled={props.disabled || props.loading}
      variant={quiet ? 'text' : 'contained'}
      color={CONFIRM_COLOR[props.variant]}
      sx={quiet ? QUIET_DESTRUCTIVE_SX : undefined}
      startIcon={props.loading ? <Spinner size={16} /> : undefined}
    >
      {props.text}
    </MuiButton>
  );
}

/** Pre-styled footer with cancel/confirm buttons pattern. */
export function ModalFooter({
  onCancel,
  onConfirm,
  cancelText,
  confirmText,
  confirmVariant = 'primary',
  isConfirmLoading = false,
  isConfirmDisabled = false,
  children,
}: ModalFooterProps): React.JSX.Element {
  const { buttons } = useIntlayer('confirmModal');
  if (children) return <>{children}</>;
  return (
    <>
      {onCancel && (
        // A quiet way out: no frame that would outweigh the main button.
        <MuiButton
          type="button"
          onClick={onCancel}
          variant="text"
          sx={{ color: 'var(--text-muted)', fontWeight: 500 }}
        >
          {cancelText ?? buttons.cancel.value}
        </MuiButton>
      )}
      {onConfirm && (
        <ConfirmBtn
          onConfirm={onConfirm}
          text={confirmText ?? buttons.confirm.value}
          variant={confirmVariant}
          loading={isConfirmLoading}
          disabled={isConfirmDisabled}
        />
      )}
    </>
  );
}
