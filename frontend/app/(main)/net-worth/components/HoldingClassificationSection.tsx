'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { useMemo, useState } from 'react';
import { Select } from '@/app/components/ui/select';
import { useIntlayer } from '@/app/i18n';
import { useHoldingClassification } from '../hooks/useHoldingClassification';
import type { InvestmentHolding } from '../hooks/useInvestments';
import {
  HOLDING_REGIONS,
  HOLDING_SECTORS,
  ISO_COUNTRIES,
  useAllocationLabels,
} from './allocation-labels';
import { LookThroughEditor } from './LookThroughEditor';
import { checkRows, DIMENSIONS, draftOf, lookThroughOf } from './look-through-form';

/** Changes whenever the server's answer does, so the form starts again from it. */
export function classificationKey(holding: InvestmentHolding): string {
  const { id, assetClass, sector, region, country, lookThrough } = holding;
  return JSON.stringify([id, assetClass, sector, region, country, lookThrough]);
}

/**
 * Where a holding's money sits: a sector, a region and a country, and for an
 * ETF or a fund its breakdown by weights. One save sends every field exactly
 * as shown. Mount with `key={classificationKey(holding)}`.
 */
export function HoldingClassificationSection({
  holding,
}: {
  holding: InvestmentHolding;
}): React.JSX.Element {
  const t = useIntlayer('allocationMix');
  const label = useAllocationLabels();
  const { save, saving, suggestSector, looking } = useHoldingClassification(holding.id);
  const [sector, setSector] = useState<string>(holding.sector ?? '');
  const [region, setRegion] = useState<string>(holding.region ?? '');
  const [country, setCountry] = useState<string>(holding.country ?? '');
  const [draft, setDraft] = useState(() => draftOf(holding.lookThrough));
  const [notFound, setNotFound] = useState(false);
  const fund = holding.assetClass === 'etf' || holding.assetClass === 'fund';
  const valid = !fund || DIMENSIONS.every(dimension => checkRows(draft[dimension]).valid);

  const options = useMemo(() => {
    const sorted = (dimension: 'sector' | 'region' | 'country', keys: readonly string[]) =>
      keys
        .map(key => ({ value: key, label: label(dimension, key) }))
        .sort((a, b) => a.label.localeCompare(b.label));
    return {
      sector: sorted('sector', HOLDING_SECTORS),
      region: sorted('region', HOLDING_REGIONS),
      country: sorted('country', ISO_COUNTRIES),
    };
  }, [label]);
  const notSet = { value: '', label: t.unclassified.value };
  const titles = {
    sector: t.tabSector.value,
    region: t.tabRegion.value,
    country: t.tabCountry.value,
  };

  const lookUp = async () => {
    const found = await suggestSector();
    setNotFound(found === null);
    if (found) setSector(found);
  };
  const submit = () =>
    save({
      sector: sector || null,
      region: region || null,
      country: country || null,
      // A share shows no breakdown, so it sends none and leaves the stored one alone.
      ...(fund ? { lookThrough: lookThroughOf(draft) } : {}),
    });

  return (
    <Box data-testid="holding-classification" sx={{ display: 'grid', gap: 2 }}>
      <Typography sx={{ fontSize: 15, fontWeight: 500 }}>{t.whereTitle}</Typography>
      <Box
        sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' } }}
      >
        <Field label={titles.sector}>
          <Select
            size="small"
            fullWidth
            value={sector}
            options={[notSet, ...options.sector]}
            onChange={value => setSector(value)}
            inputProps={{ 'aria-label': titles.sector }}
            data-testid="classification-sector"
          />
        </Field>
        <Field label={titles.region}>
          <Select
            size="small"
            fullWidth
            value={region}
            options={[notSet, ...options.region]}
            onChange={value => setRegion(value)}
            inputProps={{ 'aria-label': titles.region }}
            data-testid="classification-region"
          />
        </Field>
        <Field label={titles.country}>
          <Select
            size="small"
            fullWidth
            value={country}
            options={[notSet, ...options.country]}
            onChange={value => setCountry(value)}
            inputProps={{ 'aria-label': titles.country }}
            data-testid="classification-country"
          />
        </Field>
      </Box>
      {holding.symbol && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Button size="small" variant="text" disabled={looking} onClick={() => void lookUp()}>
            {t.lookUpSector}
          </Button>
          {notFound && (
            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: 13 }}>
              {t.noSectorFound}
            </Typography>
          )}
        </Box>
      )}

      {fund && (
        <Box sx={{ display: 'grid', gap: 2 }}>
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 500 }}>{t.breakdownTitle}</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: 13 }}>
              {t.breakdownHint}
            </Typography>
          </Box>
          {DIMENSIONS.map(dimension => (
            <LookThroughEditor
              key={dimension}
              testId={`look-through-${dimension}`}
              title={titles[dimension]}
              rows={draft[dimension]}
              options={options[dimension]}
              onChange={rows => setDraft(current => ({ ...current, [dimension]: rows }))}
            />
          ))}
        </Box>
      )}

      <Box>
        <Button
          variant="outlined"
          size="small"
          disabled={!valid || saving}
          onClick={() => void submit()}
        >
          {t.save}
        </Button>
      </Box>
    </Box>
  );
}

/** A label above its field, as every form here has it. */
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Box>
      <Typography
        variant="body2"
        sx={{ display: 'block', color: 'text.secondary', fontSize: 13, mb: 0.5 }}
      >
        {label}
      </Typography>
      {children}
    </Box>
  );
}
