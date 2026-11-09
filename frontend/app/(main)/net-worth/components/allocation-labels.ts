'use client';

import { useMemo } from 'react';
import { useIntlayer, useLocale } from '@/app/i18n';
import type {
  AllocationClass,
  AllocationSubclass,
  HoldingRegion,
  HoldingSector,
} from '@/app/lib/contracts';
import {
  HOLDING_REGIONS,
  HOLDING_SECTORS,
  ISO_COUNTRIES,
} from '@/app/lib/contracts/wealth/allocation-keys';

export { HOLDING_REGIONS, HOLDING_SECTORS, ISO_COUNTRIES };

type Key =
  | 'classEquity'
  | 'classFixedIncome'
  | 'classCash'
  | 'classRealEstate'
  | 'classCommodities'
  | 'other'
  | 'unclassified'
  | 'subStock'
  | 'subEtf'
  | 'subFund'
  | 'subBond'
  | 'metalGold'
  | 'metalSilver'
  | 'metalPlatinum'
  | 'metalPalladium'
  | 'sectorEnergy'
  | 'sectorMaterials'
  | 'sectorIndustrials'
  | 'sectorConsumerDiscretionary'
  | 'sectorConsumerStaples'
  | 'sectorHealthCare'
  | 'sectorFinancials'
  | 'sectorInformationTechnology'
  | 'sectorCommunicationServices'
  | 'sectorUtilities'
  | 'sectorRealEstate'
  | 'regionNorthAmerica'
  | 'regionLatinAmerica'
  | 'regionEurope'
  | 'regionMiddleEast'
  | 'regionAfrica'
  | 'regionAsia'
  | 'regionOceania';

const CLASS_KEYS: Record<AllocationClass, Key> = {
  equity: 'classEquity',
  fixed_income: 'classFixedIncome',
  cash: 'classCash',
  real_estate: 'classRealEstate',
  commodities: 'classCommodities',
  other: 'other',
};

const SUBCLASS_KEYS: Record<AllocationSubclass, Key> = {
  stock: 'subStock',
  etf: 'subEtf',
  fund: 'subFund',
  bond: 'subBond',
  cash: 'classCash',
  real_estate: 'classRealEstate',
  gold: 'metalGold',
  silver: 'metalSilver',
  platinum: 'metalPlatinum',
  palladium: 'metalPalladium',
  other: 'other',
};

const SECTOR_KEYS: Record<HoldingSector, Key> = {
  energy: 'sectorEnergy',
  materials: 'sectorMaterials',
  industrials: 'sectorIndustrials',
  consumer_discretionary: 'sectorConsumerDiscretionary',
  consumer_staples: 'sectorConsumerStaples',
  health_care: 'sectorHealthCare',
  financials: 'sectorFinancials',
  information_technology: 'sectorInformationTechnology',
  communication_services: 'sectorCommunicationServices',
  utilities: 'sectorUtilities',
  real_estate: 'sectorRealEstate',
};

const REGION_KEYS: Record<HoldingRegion, Key> = {
  north_america: 'regionNorthAmerica',
  latin_america: 'regionLatinAmerica',
  europe: 'regionEurope',
  middle_east: 'regionMiddleEast',
  africa: 'regionAfrica',
  asia: 'regionAsia',
  oceania: 'regionOceania',
};

/** A country's name in the reader's language; the code itself where the browser has none. */
export function countryName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale, 'en'], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

export type AllocationDimension = 'class' | 'subclass' | 'sector' | 'region' | 'country';

/** Names for every key the allocation and the classification fields use. */
export function useAllocationLabels() {
  const t = useIntlayer('allocationMix');
  const { locale } = useLocale();
  return useMemo(() => {
    // A key from an older answer the lists no longer have is shown as it is.
    const text = (key: Key | undefined) => (key ? t[key].value : undefined);
    return (dimension: AllocationDimension, key: string): string => {
      if (key === 'other') return t.other.value;
      if (key === 'unclassified') return t.unclassified.value;
      switch (dimension) {
        case 'class':
          return text(CLASS_KEYS[key as AllocationClass]) ?? key;
        case 'subclass':
          return text(SUBCLASS_KEYS[key as AllocationSubclass]) ?? key;
        case 'sector':
          return text(SECTOR_KEYS[key as HoldingSector]) ?? key;
        case 'region':
          return text(REGION_KEYS[key as HoldingRegion]) ?? key;
        case 'country':
          return countryName(key, locale);
      }
    };
  }, [t, locale]);
}
