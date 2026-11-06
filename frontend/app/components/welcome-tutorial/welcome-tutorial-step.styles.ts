import type { SxProps, Theme } from '@mui/material';

// A laptop at 150% scale has about 570px of height: the large type would push the list out of view.
const SHORT_SCREEN = '@media (min-width: 900px) and (max-height: 700px)';

/** One guide page: only words, centred on the screen. It scrolls when the screen is tiny. */
export const bodySx = {
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  px: { xs: 2, md: 6 },
  py: { xs: 3, md: 5 },
  display: 'flex',
  [SHORT_SCREEN]: { py: 2 },
} satisfies SxProps<Theme>;

// Auto margins, not align-items: a column taller than the screen must keep its top in reach.
export const textColumnSx = {
  m: 'auto',
  width: '100%',
  maxWidth: 800,
  textAlign: 'center',
} satisfies SxProps<Theme>;

export const eyebrowSx = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 1,
  color: 'var(--primary)',
  fontSize: { xs: 15, md: 18 },
  fontWeight: 500,
} satisfies SxProps<Theme>;

export const taglineSx = {
  mt: 1.5,
  fontSize: { xs: 32, md: 52 },
  fontWeight: 500,
  lineHeight: 1.15,
  textWrap: 'balance',
  color: 'var(--foreground)',
  [SHORT_SCREEN]: { mt: 0.5, fontSize: 36 },
} satisfies SxProps<Theme>;

export const descriptionSx = {
  mt: 2,
  fontSize: { xs: 18, md: 22 },
  lineHeight: 1.5,
  textWrap: 'balance',
  color: 'var(--text-muted)',
  [SHORT_SCREEN]: { mt: 1, fontSize: 18 },
} satisfies SxProps<Theme>;

export const pointsSx = {
  listStyle: 'none',
  p: 0,
  m: 0,
  mt: { xs: 3, md: 5 },
  display: 'grid',
  gap: { xs: 2.5, md: 3 },
  [SHORT_SCREEN]: { mt: 2.5, gap: 1.5 },
} satisfies SxProps<Theme>;

export const pointTitleSx = {
  fontSize: { xs: 17, md: 20 },
  fontWeight: 500,
  color: 'var(--foreground)',
  [SHORT_SCREEN]: { fontSize: 16 },
} satisfies SxProps<Theme>;

export const pointTextSx = {
  mt: 0.5,
  fontSize: { xs: 16, md: 18 },
  lineHeight: 1.5,
  color: 'var(--text-muted)',
  [SHORT_SCREEN]: { mt: 0, fontSize: 15 },
} satisfies SxProps<Theme>;
