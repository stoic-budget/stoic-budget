'use client';

import { Box, Typography } from '@mui/material';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { useTheme } from 'next-themes';
import { Spinner } from '@/app/components/ui/spinner';
import { useIntlayer } from '@/app/i18n';
import { tokens } from '@/lib/theme-tokens';

/** Asks before a receipt becomes a new custom table. */
export function ReceiptExportDialog({
  open,
  exporting,
  disabled,
  onClose,
  onConfirm,
}: {
  open: boolean;
  exporting: boolean;
  disabled: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? tokens.dark.color : tokens.color;
  const t = useIntlayer('receiptDocumentPage');
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontSize: 22, fontWeight: 600 }}>{t.confirmExportTitle}</DialogTitle>
      <DialogContent dividers>
        <Typography style={{ fontSize: 16, lineHeight: 2, color: c.ink800 }}>
          {t.confirmExportBody}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 4, py: 3, gap: 1.5 }}>
        <Box
          component="button"
          type="button"
          onClick={onClose}
          sx={{
            border: `1px solid ${c.ink150}`,
            bgcolor: 'background.paper',
            px: 3,
            py: 1.25,
            fontSize: 16,
            fontWeight: 500,
            color: c.ink700,
            cursor: 'pointer',
            '&:hover': { borderColor: 'primary.main', color: 'primary.main' },
          }}
        >
          {t.cancel}
        </Box>
        <Box
          component="button"
          type="button"
          onClick={onConfirm}
          disabled={disabled}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 1,
            bgcolor: 'var(--primary-fill)',
            px: 3,
            py: 1.25,
            fontSize: 16,
            fontWeight: 500,
            color: '#fff',
            cursor: 'pointer',
            border: 'none',
            '&:hover': { bgcolor: 'primary.dark' },
            '&:disabled': { cursor: 'not-allowed', opacity: 0.5 },
          }}
        >
          {exporting ? <Spinner className="h-4 w-4" /> : null}
          {t.confirmExport}
        </Box>
      </DialogActions>
    </Dialog>
  );
}
