'use client';

import { Box } from '@mui/material';
import { useIntlayer } from '@/app/i18n';
import { tokens } from '@/lib/theme-tokens';

const previewPlaceholderSx = (inkColor: string) => ({
  display: 'flex',
  height: '100%',
  minHeight: 388,
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 14,
  color: inkColor,
});

export function ReceiptPreviewContent({
  loading,
  error,
  url,
  isPdf,
  title,
  inkColor,
  borderColor,
}: {
  loading: boolean;
  error: string | null;
  url: string | null;
  isPdf: boolean;
  title: string;
  inkColor: string;
  borderColor: string;
}) {
  const t = useIntlayer('receiptDocumentPage');
  if (loading) {
    return <Box sx={previewPlaceholderSx(inkColor)}>{t.preparingPreview}</Box>;
  }
  // `error` is only ever set when the preview fetch failed; show the localized message.
  if (error || !url) {
    return <Box sx={previewPlaceholderSx(inkColor)}>{t.previewUnavailable}</Box>;
  }
  if (isPdf) {
    return (
      <iframe
        src={url}
        title={title}
        style={{
          height: '100%',
          minHeight: 760,
          width: '100%',
          border: `1px solid ${borderColor}`,
          borderRadius: tokens.radius.md,
          background: 'var(--card-bg)',
          display: 'block',
        }}
      />
    );
  }
  return (
    <Box sx={{ display: 'flex', minHeight: '100%', minWidth: '100%', justifyContent: 'center' }}>
      <Box
        component="img"
        src={url}
        alt={title}
        sx={{
          height: 'auto',
          minHeight: 0,
          width: '180%',
          minWidth: 720,
          maxWidth: 'none',
          objectFit: 'contain',
          // A phone fits the whole receipt to the width instead of a zoomed crop.
          '@media (max-width: 1023px)': { width: '100%', minWidth: 0 },
        }}
      />
    </Box>
  );
}
