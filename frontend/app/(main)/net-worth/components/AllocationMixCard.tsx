'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { categoryTones } from '@/app/components/charts/chart-theme';
import { LazyNestedDonut } from '@/app/components/charts/lazy-charts';
import { PrivateAmount } from '@/app/components/ui/private-amount';
import { TextTabs } from '@/app/components/ui/text-tabs';
import { useIntlayer } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import { usePrivacyMode } from '@/app/lib/privacy-mode';
import {
  type InvestmentAllocation,
  useInvestmentAllocation,
} from '../hooks/useInvestmentAllocation';
import { AllocationBars } from './AllocationBars';
import { type AllocationDimension, useAllocationLabels } from './allocation-labels';
import { CardTitle, cardSx, WholeMoney } from './net-worth-ui';

type Cut = 'class' | 'sector' | 'region' | 'country';
const CUTS: Record<Exclude<Cut, 'class'>, 'sectors' | 'regions' | 'countries'> = {
  sector: 'sectors',
  region: 'regions',
  country: 'countries',
};

/** The children of a group in lighter shades of its tone, never below readable. */
const shade = (index: number) => Math.max(1 - index * 0.22, 0.4);

/** Rings for the class view: groups inside, their parts outside, both in the group's tone. */
export function classRings(
  classes: InvestmentAllocation['classes'],
  label: (dimension: AllocationDimension, key: string) => string,
) {
  const tones = categoryTones(
    classes.map(item => ({ key: item.key, isOther: item.key === 'other' })),
  );
  const inner = classes.map((item, index) => ({
    key: item.key,
    name: label('class', item.key),
    value: item.amount,
    percent: item.percent,
    color: tones[index],
  }));
  const outer = classes.flatMap((item, index) =>
    item.subclasses.map((sub, position) => ({
      key: `${item.key}:${sub.key}`,
      name: label('subclass', sub.key),
      value: sub.amount,
      percent: sub.percent,
      color: tones[index],
      opacity: shade(position),
    })),
  );
  return { inner, outer };
}

/**
 * Every holding by class (a nested donut: class, then what it is made of), by
 * sector, region and country, funds spread by their breakdown, without the
 * accounts the page leaves out. Hidden until something is held; when nothing
 * held has a rate, only the note saying so.
 */
export function AllocationMixCard({ locale, excluded }: { locale: string; excluded: string[] }) {
  const t = useIntlayer('allocationMix');
  const label = useAllocationLabels();
  const privacy = usePrivacyMode();
  const { data } = useInvestmentAllocation(excluded);
  const [cut, setCut] = useState<Cut>('class');
  if (!data || (data.total <= 0 && data.unvalued === 0)) return null;
  const valued = data.total > 0;

  const currency = data.currency;
  const rings = classRings(data.classes, label);
  return (
    <Box sx={cardSx} data-testid="allocation-mix">
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <CardTitle>{t.title}</CardTitle>
        {valued && (
          <TextTabs
            value={cut}
            onChange={setCut}
            ariaLabel={t.title.value}
            options={[
              { value: 'class', label: t.tabClass.value },
              { value: 'sector', label: t.tabSector.value },
              { value: 'region', label: t.tabRegion.value },
              { value: 'country', label: t.tabCountry.value },
            ]}
          />
        )}
      </Box>
      <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5, mb: 2, fontSize: 13 }}>
        {t.hint}
        {data.unvalued > 0 && ` ${t.unvalued.value.replaceAll('{{count}}', String(data.unvalued))}`}
      </Typography>

      {!valued ? null : cut === 'class' ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '200px 1fr' },
            gap: 3,
            alignItems: 'center',
          }}
        >
          <Box sx={{ width: 200, height: 200, justifySelf: 'center' }} aria-hidden>
            <LazyNestedDonut
              inner={rings.inner}
              outer={rings.outer}
              quiet={privacy}
              formatAmount={value => formatMoney(value, currency, locale, { fractionDigits: 0 })}
            />
          </Box>
          <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1.25 }}>
            {data.classes.map((item, index) => (
              <Box component="li" key={item.key} data-testid={`allocation-class-${item.key}`}>
                <Row
                  color={rings.inner[index].color}
                  name={label('class', item.key)}
                  percent={item.percent}
                  amount={<WholeMoney value={item.amount} currency={currency} locale={locale} />}
                  strong
                />
                {item.subclasses.length > 1 &&
                  item.subclasses.map(sub => (
                    <Box key={sub.key} sx={{ pl: 2.5, mt: 0.5 }}>
                      <Row
                        name={label('subclass', sub.key)}
                        percent={sub.percent}
                        amount={
                          <WholeMoney value={sub.amount} currency={currency} locale={locale} />
                        }
                      />
                    </Box>
                  ))}
              </Box>
            ))}
          </Box>
        </Box>
      ) : (
        <AllocationBars
          currency={currency}
          locale={locale}
          items={data[CUTS[cut]].map(item => ({
            key: item.key,
            label: label(cut, item.key),
            amount: item.amount,
            percent: item.percent,
          }))}
        />
      )}
    </Box>
  );
}

function Row({
  color,
  name,
  percent,
  amount,
  strong = false,
}: {
  color?: string;
  name: string;
  percent: number;
  amount: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      {color && (
        <Box sx={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, bgcolor: color }} />
      )}
      <Typography
        variant="body2"
        noWrap
        sx={{ flexGrow: 1, minWidth: 0, color: strong ? 'text.primary' : 'text.secondary' }}
      >
        {name}
      </Typography>
      <Typography
        variant="body2"
        sx={{ color: 'text.secondary', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}
      >
        <PrivateAmount>{percent}%</PrivateAmount>
      </Typography>
      <Typography
        variant="body2"
        sx={{
          fontWeight: strong ? 500 : 400,
          flexShrink: 0,
          minWidth: 90,
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {amount}
      </Typography>
    </Box>
  );
}
