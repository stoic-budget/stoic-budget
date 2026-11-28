'use client';

import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Skeleton from '@mui/material/Skeleton';
import { useIntlayer } from '@/app/i18n';
import { AdminGroup, AdminHeader } from '../components/AdminGroup';
import { useParserHealth } from '../hooks/useParserHealth';
import { sortBanks } from '../lib/admin-summary';
import { ParserBankRow } from './components/ParserBankRow';

const SKELETON_KEYS = ['bank-0', 'bank-1', 'bank-2'];

/** A line inside the group in place of rows: loading failed, nothing yet, or not an admin. */
function Note({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <Box component="li" sx={{ px: 2, py: 1.5, fontSize: 14, color: 'var(--text-muted)' }}>
      {children}
    </Box>
  );
}

/**
 * Parser health for the server's administrator: per bank, how statements
 * parsed over the last 30 days and the layouts they came in, so a bank that
 * changes its format shows up before its users notice.
 */
export default function ParserHealthPage(): React.ReactElement {
  const t = useIntlayer('adminParsingPage');
  const adminPage = useIntlayer('adminPage');
  const { isAdmin, health, isPending, isError } = useParserHealth();

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4, px: { xs: 2, md: 4 } }}>
      <AdminHeader
        back={{ href: '/admin', label: adminPage.title }}
        title={t.title}
        subtitle={t.subtitle}
      />
      <AdminGroup>
        {!isAdmin ? (
          <Note>{t.notAdmin}</Note>
        ) : isError ? (
          <Note>
            <span role="alert" style={{ color: 'var(--money-down)' }}>
              {t.loadFailed}
            </span>
          </Note>
        ) : isPending || !health ? (
          SKELETON_KEYS.map(key => (
            <Box component="li" key={key} sx={{ px: 2, py: 1.25 }}>
              <Skeleton variant="text" height={28} />
            </Box>
          ))
        ) : health.banks.length === 0 ? (
          <Note>{t.empty}</Note>
        ) : (
          sortBanks(health.banks).map(bank => <ParserBankRow key={bank.bank} bank={bank} />)
        )}
      </AdminGroup>
    </Container>
  );
}
