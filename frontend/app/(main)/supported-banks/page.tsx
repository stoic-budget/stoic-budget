'use client';

import { listSupportedBanks, resolveBankLogo } from '@bank-logos';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import { BankLogoAvatar } from '@/app/components/BankLogoAvatar';
import { CheckCircle2 } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';
import { getNestedValue, resolveLabel } from '@/app/lib/side-panel-utils';
import { tokens } from '@/lib/theme-tokens';

export default function SupportedBanksPage(): React.JSX.Element {
  const t = useIntlayer('supportedBanksPage');
  const banks = listSupportedBanks();
  // The placeholder picture has a white background: a bank without a logo of
  // its own gets the avatar's line icon, which follows the theme.
  const placeholderLogo = resolveBankLogo(null).src;

  return (
    <Box sx={{ px: { xs: 2, sm: 3, lg: 4 }, pt: 'var(--seneca-page-top, 32px)', pb: 4 }}>
      <Box
        sx={{
          border: '1px solid var(--border-color)',
          bgcolor: 'background.paper',
          p: { xs: 2.5, sm: 3 },
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
        }}
      >
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
          <Chip
            icon={<CheckCircle2 size={14} />}
            label={resolveLabel(getNestedValue(t, ['parserStatus']))}
            size="small"
            sx={{
              bgcolor: 'var(--color-success-soft-bg)',
              color: 'var(--color-success-soft-text)',
              border: '1px solid var(--color-success-soft-border)',
              fontWeight: 600,
              borderRadius: tokens.radius.full,
            }}
          />
          <Typography sx={{ fontSize: 14, color: 'var(--text-muted)' }}>
            {resolveLabel(getNestedValue(t, ['formatsLabel']))}:{' '}
            {resolveLabel(getNestedValue(t, ['pdfStatements']))}
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          mt: 3,
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
        }}
      >
        {banks.map(bank => (
          <Box
            component="article"
            key={bank.key}
            data-supported-bank={bank.key}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              border: '1px solid var(--border-color)',
              borderRadius: tokens.radius.md,
              bgcolor: 'background.paper',
              p: 1.5,
            }}
          >
            <Box
              sx={{
                display: 'flex',
                flexShrink: 0,
                alignItems: 'center',
                justifyContent: 'center',
                width: 40,
                height: 40,
                borderRadius: tokens.radius.sm,
                bgcolor: 'var(--icon-badge-bg)',
              }}
            >
              <BankLogoAvatar
                bankName={bank.src === placeholderLogo ? null : bank.key}
                size={28}
                rounded={false}
              />
            </Box>
            <Typography sx={{ fontSize: 15, fontWeight: 500, color: 'var(--foreground)' }}>
              {bank.displayName}
            </Typography>
          </Box>
        ))}
      </Box>

      <Typography variant="body2" sx={{ mt: 3, fontWeight: 500, color: 'var(--muted-foreground)' }}>
        {resolveLabel(getNestedValue(t, ['comingSoon']))}
      </Typography>
    </Box>
  );
}
