'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import { useMemo, useState } from 'react';
import { CountryDrawer } from '../components/CountryDrawer';
import { FlagIcon } from '../components/FlagIcon';
import { FieldLabel } from '../components/OnboardingField';
import { PickerField } from '../components/PickerField';
import { StepHeading } from '../components/StepHeading';
import { countryOptions, suggestedCountry, useJurisdictions } from '../lib/tax-countries';
import { useOnboardingText } from '../lib/useOnboardingText';
import type { SupportedLocale } from '../useOnboardingWizard';

interface TaxStepProps {
  locale: SupportedLocale;
  taxCountry: string | null;
  onTaxCountryChange: (code: string | null) => void;
  /** "Not listed / decide later": clears the country and moves on. */
  onDefer: () => void;
}

export function TaxStep({ locale, taxCountry, onTaxCountryChange, onDefer }: TaxStepProps) {
  const text = useOnboardingText(locale);
  const jurisdictions = useJurisdictions();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const countryLabel = text(['tax', 'countryLabel']);

  const options = useMemo(() => {
    const list = jurisdictions.data ?? [];
    return countryOptions(
      list,
      locale,
      suggestedCountry(list.map(jurisdiction => jurisdiction.code)),
    );
  }, [jurisdictions.data, locale]);
  const selectedOption = options.find(option => option.code === taxCountry);

  return (
    <Box
      component="section"
      sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 4, md: 3 } }}
    >
      <StepHeading title={text(['tax', 'title'])} subtitle={text(['tax', 'subtitle'])} />

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {jurisdictions.isPending ? (
          <>
            <FieldLabel>{countryLabel}</FieldLabel>
            <Box sx={{ height: 48, display: 'flex', alignItems: 'center' }}>
              <CircularProgress size={20} />
            </Box>
          </>
        ) : jurisdictions.isError ? (
          <>
            <FieldLabel>{countryLabel}</FieldLabel>
            <Box
              component="p"
              role="alert"
              sx={{ m: 0, fontSize: 14, color: 'var(--destructive)' }}
            >
              {text(['tax', 'loadFailed'])}
            </Box>
          </>
        ) : (
          <PickerField
            id="onboarding-tax-country"
            label={countryLabel}
            value={
              selectedOption ? (
                <>
                  <FlagIcon code={selectedOption.code} />
                  {selectedOption.name}
                </>
              ) : null
            }
            placeholder={text(['tax', 'countryPlaceholder'])}
            onOpen={() => setDrawerOpen(true)}
          />
        )}
        {taxCountry ? null : (
          <Box component="p" sx={{ m: 0, fontSize: 13, color: 'var(--muted-foreground)' }}>
            {text(['tax', 'notListedHint'])}
          </Box>
        )}
      </Box>

      <Button
        variant="text"
        onClick={onDefer}
        sx={{
          alignSelf: 'flex-start',
          ml: -1,
          textTransform: 'none',
          fontSize: 14,
          color: 'var(--muted-foreground)',
          textDecoration: 'underline',
          textUnderlineOffset: 3,
          '&:hover': { color: 'var(--foreground)', bgcolor: 'transparent' },
        }}
      >
        {text(['tax', 'notListed'])}
      </Button>

      <CountryDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={countryLabel}
        searchPlaceholder={text(['tax', 'countrySearch'])}
        emptyLabel={text(['tax', 'countryNotFound'])}
        options={options}
        selected={taxCountry}
        onSelect={onTaxCountryChange}
      />
    </Box>
  );
}
