'use client';

import Box from '@mui/material/Box';
import { PrivateAmount } from '@/app/components/ui/private-amount';
import { useIntlayer } from '@/app/i18n';
import type { PropertyLine } from '@/app/lib/contracts';
import { formatMoney } from '@/app/lib/format-money';
import { useUserFormat } from '@/app/lib/user-format-store';
import { plainLineName } from '../net-worth-ui';

const UNIT_LABEL: Record<string, string> = { m2: 'm²', ft2: 'ft²', km: 'km', mi: 'mi' };

/** "72.5 m² · 1998 · 1 Example Street" or "ACME Roadster · 2019 · 42,000 km". */
export function attributeSummary(property: PropertyLine, locale: string): string {
  const a: Record<string, unknown> = property.attributes ?? {};
  const number = (value: unknown) =>
    typeof value === 'number' ? new Intl.NumberFormat(locale).format(value) : null;
  const withUnit = (value: unknown, unit: unknown) => {
    const shown = number(value);
    return shown ? `${shown} ${UNIT_LABEL[String(unit)] ?? ''}`.trim() : null;
  };
  const parts =
    property.kind === 'real_estate'
      ? [withUnit(a.area, a.areaUnit ?? 'm2'), a.yearBuilt, a.address]
      : [
          [a.make, a.model].filter(Boolean).join(' '),
          a.year,
          withUnit(a.mileage, a.mileageUnit ?? 'km'),
        ];
  return parts.filter(part => part !== null && part !== undefined && part !== '').join(' · ');
}

const labelSx = { fontSize: 13, color: 'var(--text-muted)' } as const;
const figureSx = {
  fontSize: 15,
  fontWeight: 500,
  color: 'var(--foreground)',
  fontVariantNumeric: 'tabular-nums',
} as const;

function Figure({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <Box sx={{ display: 'grid', gap: 0.25, minWidth: 0 }}>
      <Box component="span" sx={labelSx}>
        {label}
      </Box>
      <Box component="span" sx={figureSx}>
        {children}
      </Box>
    </Box>
  );
}

export function PropertyRow({
  property,
  currency,
  locale,
  onEdit,
}: {
  property: PropertyLine;
  currency: string;
  locale: string;
  onEdit: () => void;
}): React.JSX.Element {
  const t = useIntlayer('netWorthProperty');
  const { formatDate } = useUserFormat();
  const money = (value: number) => (
    <PrivateAmount title={formatMoney(value, currency, locale)}>
      {formatMoney(value, currency, locale, { fractionDigits: 0 })}
    </PrivateAmount>
  );
  const summary = attributeSummary(property, locale);
  const unvalued = property.valuedOn === null;

  return (
    <Box
      component="article"
      sx={{
        py: 2,
        borderTop: '1px solid var(--border)',
        '&:first-of-type': { borderTop: 'none', pt: 0.5 },
        display: 'grid',
        gap: 1.25,
      }}
    >
      <Box
        sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Box
            component="h3"
            sx={{ m: 0, fontSize: 14, fontWeight: 500, color: 'var(--foreground)' }}
          >
            {plainLineName(property.name)}
          </Box>
          {summary && <Box sx={{ ...labelSx, overflowWrap: 'anywhere' }}>{summary}</Box>}
        </Box>
        <Box
          component="button"
          type="button"
          onClick={onEdit}
          aria-label={`${t.details.value}: ${plainLineName(property.name)}`}
          sx={{
            flexShrink: 0,
            border: 0,
            background: 'none',
            p: 0.5,
            font: 'inherit',
            fontSize: 14,
            color: 'var(--primary)',
            cursor: 'pointer',
          }}
        >
          {t.details}
        </Box>
      </Box>

      {unvalued ? (
        <Box sx={labelSx}>{t.noValue}</Box>
      ) : (
        <>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(2, minmax(0, 1fr))',
                sm: 'repeat(4, minmax(0, 1fr))',
              },
              gap: 1.5,
            }}
          >
            <Figure label={t.value}>{money(property.value)}</Figure>
            <Figure label={t.owed}>{property.debt ? money(property.debt.amount) : '—'}</Figure>
            <Figure label={t.equity}>{money(property.equity)}</Figure>
            <Figure label={t.ltv}>
              {property.ltv === null
                ? '—'
                : new Intl.NumberFormat(locale, {
                    style: 'percent',
                    maximumFractionDigits: 1,
                  }).format(property.ltv)}
            </Figure>
          </Box>
          <Box sx={{ ...labelSx, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
            {property.estimated && (
              <Box
                component="span"
                sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--attention)',
                  }}
                />
                {t.estimated}
              </Box>
            )}
            <span>
              {t.valuedOn}: {formatDate(property.valuedOn)}
              {property.debt ? ` · ${property.debt.name}` : ''}
            </span>
          </Box>
        </>
      )}
    </Box>
  );
}
