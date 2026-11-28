'use client';

import Box from '@mui/material/Box';
import type React from 'react';
import { useState } from 'react';
import { BankLogoAvatar } from '@/app/components/BankLogoAvatar';
import { ChevronDown, ChevronRight } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';
import type { ParserHealthBank, ParserHealthLayout } from '@/app/lib/contracts';
import { formatStoredDate } from '@/app/lib/user-format-store';
import { resolveBankLogo } from '../../../bank-logos';
import { StatusDot } from '../../components/AdminGroup';
import { bankLevel } from '../../lib/admin-summary';

type Labels = ReturnType<typeof useIntlayer<'adminParsingPage'>>;

const MUTED = { fontSize: 13, color: 'var(--text-muted)' } as const;

/** What went wrong with the bank's statements, in words; nothing when all went well. */
function problems(bank: ParserHealthBank, t: Labels): string[] {
  const parts: [string, number][] = [
    [t.errors.value, bank.errors],
    [t.needsReview.value, bank.needsReview],
    [t.declined.value, bank.declined],
  ];
  const found = parts.filter(([, count]) => count > 0).map(([label, count]) => `${label} ${count}`);
  return bank.layouts.some(layout => layout.isNew) ? [...found, t.newLayout.value] : found;
}

/** One layout: the parser and when it was seen; its table headings only on request. */
function LayoutLine({ layout, t }: { layout: ParserHealthLayout; t: Labels }): React.JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <Box component="li" sx={{ listStyle: 'none', py: 1 }}>
      {/* One run of text, so a narrow screen wraps it like a sentence. */}
      <Box sx={MUTED}>
        {layout.isNew ? (
          <Box component="span" sx={{ color: 'var(--foreground)', mr: 1 }}>
            <StatusDot level="warning" /> {t.newLayout}
          </Box>
        ) : null}
        <span style={{ fontFamily: 'monospace' }}>{layout.parser}</span> · {t.statements}{' '}
        {layout.statements} · {formatStoredDate(layout.firstSeen)} –{' '}
        {formatStoredDate(layout.lastSeen)}{' '}
        <Box
          component="button"
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(value => !value)}
          sx={{
            ...MUTED,
            p: 0,
            border: 0,
            background: 'none',
            cursor: 'pointer',
            textDecoration: 'underline',
            textUnderlineOffset: 3,
            '&:hover': { color: 'var(--foreground)' },
          }}
        >
          {t.headings}
        </Box>
      </Box>
      {open ? (
        <Box sx={{ mt: 0.75, pl: 1.5, borderLeft: '2px solid var(--border)' }}>
          {layout.headings.map(line => (
            <Box
              key={line}
              sx={{ ...MUTED, fontSize: 12, fontFamily: 'monospace', wordBreak: 'break-word' }}
            >
              {line}
            </Box>
          ))}
          {layout.unknownWords.length > 0 ? (
            <Box sx={{ ...MUTED, fontSize: 12, mt: 0.5 }}>
              {t.unknownWords}: {layout.unknownWords.join(', ')}
            </Box>
          ) : null}
        </Box>
      ) : null}
    </Box>
  );
}

/** The bank's counts in one line, why statements were held, and its layouts. */
function BankDetails({ bank, t }: { bank: ParserHealthBank; t: Labels }): React.JSX.Element {
  const counts = [
    `${t.statements.value} ${bank.statements}`,
    `${t.needsReview.value} ${bank.needsReview}`,
    `${t.errors.value} ${bank.errors}`,
    `${t.declined.value} ${bank.declined}`,
  ].join(' · ');
  return (
    <Box sx={{ px: 2, pb: 1.5, pl: 7 }}>
      <Box sx={{ ...MUTED, fontVariantNumeric: 'tabular-nums' }}>{counts}</Box>
      {bank.reasons.length > 0 ? (
        <Box sx={{ ...MUTED, mt: 0.5 }}>
          {t.reasons}:{' '}
          <span style={{ fontFamily: 'monospace' }}>
            {bank.reasons.map(reason => `${reason.code} · ${reason.count}`).join(', ')}
          </span>
        </Box>
      ) : null}
      {bank.layouts.length > 0 ? (
        <Box component="ul" sx={{ m: 0, mt: 0.5, p: 0 }}>
          {bank.layouts.map(layout => (
            <LayoutLine key={layout.fingerprint} layout={layout} t={t} />
          ))}
        </Box>
      ) : null}
    </Box>
  );
}

/** "Statements N", then what went wrong, if anything, after a dot of its level. */
function Summary({
  bank,
  found,
  t,
}: {
  bank: ParserHealthBank;
  found: string[];
  t: Labels;
}): React.JSX.Element {
  return (
    <>
      {t.statements} {bank.statements}
      {found.length > 0 ? (
        <>
          {' · '}
          <StatusDot level={bankLevel(bank)} />{' '}
          <span style={{ color: 'var(--foreground)' }}>{found.join(' · ')}</span>
        </>
      ) : null}
    </>
  );
}

/**
 * One bank in the list: logo, name, how many statements and what went wrong,
 * if anything. A click opens the details in place: a layout seen for the first
 * time is how a bank's new format shows up.
 */
export function ParserBankRow({ bank }: { bank: ParserHealthBank }): React.ReactElement {
  const t = useIntlayer('adminParsingPage');
  const [open, setOpen] = useState(false);
  const name = bank.bank === 'other' ? t.otherBank.value : resolveBankLogo(bank.bank).displayName;
  const found = problems(bank, t);
  const Chevron = open ? ChevronDown : ChevronRight;
  return (
    <li>
      <Box
        component="button"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
        sx={{
          // Logo, name, summary, chevron in a row; on a phone the summary drops under the name.
          display: 'grid',
          gridTemplateColumns: { xs: 'auto 1fr auto', sm: 'auto 1fr auto auto' },
          gridTemplateAreas: { xs: '"logo name chev" ". sum ."', sm: '"logo name sum chev"' },
          alignItems: 'center',
          columnGap: 1.5,
          rowGap: 0.25,
          width: '100%',
          px: 2,
          py: 1.25,
          border: 0,
          background: 'none',
          textAlign: 'left',
          cursor: 'pointer',
          color: 'var(--foreground)',
          '&:hover': { bgcolor: 'var(--surface-soft)' },
        }}
      >
        <Box sx={{ gridArea: 'logo', display: 'flex' }}>
          <BankLogoAvatar bankName={bank.bank === 'other' ? null : bank.bank} size={28} />
        </Box>
        <Box component="span" sx={{ gridArea: 'name', minWidth: 0, fontSize: 14, fontWeight: 500 }}>
          {name}
        </Box>
        <Box
          component="span"
          sx={{
            ...MUTED,
            gridArea: 'sum',
            textAlign: { xs: 'left', sm: 'right' },
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <Summary bank={bank} found={found} t={t} />
        </Box>
        <Chevron
          size={18}
          aria-hidden
          style={{ gridArea: 'chev', color: 'var(--text-muted)', flexShrink: 0 }}
        />
      </Box>
      {open ? <BankDetails bank={bank} t={t} /> : null}
    </li>
  );
}
