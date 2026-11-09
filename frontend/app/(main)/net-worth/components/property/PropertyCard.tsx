'use client';

import Box from '@mui/material/Box';
import { useState } from 'react';
import { useIntlayer } from '@/app/i18n';
import type { PropertyLine } from '@/app/lib/contracts';
import { useSaveProperty } from '../../hooks/useProperty';
import { CardTitle, cardSx } from '../net-worth-ui';
import { PropertyDrawer } from './PropertyDrawer';
import { PropertyRow } from './PropertyRow';

/**
 * Real estate and vehicles with what is owed on each: the value, the debt,
 * the owner's equity and the loan-to-value ratio. A view of figures net
 * worth already counts once each, so nothing here changes the total.
 */
export function PropertyCard({
  properties,
  currency,
  locale,
}: {
  properties: PropertyLine[];
  currency: string;
  locale: string;
}): React.JSX.Element | null {
  const t = useIntlayer('netWorthProperty');
  // The id, not a copy of the row: the drawer reads the property from the
  // refreshed list, so a save or another tab never leaves it on stale figures.
  const [openId, setOpenId] = useState<string | null>(null);
  const { save, saving } = useSaveProperty(t.saveFailed.value);
  const open = properties.find(property => property.accountId === openId) ?? null;

  if (properties.length === 0) return null;

  return (
    <Box sx={cardSx}>
      <CardTitle>{t.title}</CardTitle>
      <Box sx={{ mt: 1.5, display: 'grid' }}>
        {properties.map(property => (
          <PropertyRow
            key={property.accountId}
            property={property}
            currency={currency}
            locale={locale}
            onEdit={() => setOpenId(property.accountId)}
          />
        ))}
      </Box>
      <PropertyDrawer
        key={open?.accountId ?? 'closed'}
        property={open}
        saving={saving}
        onClose={() => setOpenId(null)}
        onSave={async body => {
          if (open && (await save(open.accountId, body))) setOpenId(null);
        }}
      />
    </Box>
  );
}
