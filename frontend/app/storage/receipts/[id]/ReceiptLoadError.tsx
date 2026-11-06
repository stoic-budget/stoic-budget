'use client';

import { Box } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { AlertCircle, ArrowLeft } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';
import { tokens } from '@/lib/theme-tokens';

/** Shown when the receipt could not be read: why, and a way back. */
export function ReceiptLoadError({ message }: { message: string | null }) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === 'dark' ? tokens.dark.color : tokens.color;
  const t = useIntlayer('receiptDocumentPage');
  return (
    <Box
      className="container-shared"
      sx={{
        height: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        px: { xs: 2, sm: 3, lg: 4 },
        py: 4,
      }}
    >
      <Box
        role="alert"
        sx={{
          mb: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          border: `1px solid ${c.dangerSoft}`,
          borderRadius: tokens.radius.md,
          bgcolor: c.dangerSoft,
          px: 2,
          py: 1.5,
          fontSize: 14,
          color: c.danger,
        }}
      >
        <AlertCircle size={18} aria-hidden style={{ flexShrink: 0 }} />
        {message || t.notFound}
      </Box>
      <Box
        component="button"
        type="button"
        onClick={() => router.back()}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          fontSize: 13,
          fontWeight: 500,
          color: c.ink500,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          p: 0,
          '&:hover': { color: c.ink700 },
        }}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {t.back}
      </Box>
    </Box>
  );
}
