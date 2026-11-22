import type { PropertyKind, PropertyLine } from '@/app/lib/contracts';
import type { ContractInput } from '@/app/lib/query-fn-schema';

export type PropertyBody = ContractInput<'UpdatePropertyBody'>;

/** The drawer's fields, as typed. `debt` is `kind:id`, or empty for none. */
export interface PropertyForm {
  area: string;
  areaUnit: 'm2' | 'ft2';
  yearBuilt: string;
  address: string;
  make: string;
  model: string;
  year: string;
  mileage: string;
  mileageUnit: 'km' | 'mi';
  debt: string;
  depreciationRate: string;
}

type NumberField = 'area' | 'yearBuilt' | 'year' | 'mileage' | 'depreciationRate';

/** The contract's length caps on the text fields (VehicleAttributes, RealEstateAttributes). */
export const TEXT_MAX: Partial<Record<keyof PropertyForm, number>> = {
  address: 200,
  make: 60,
  model: 60,
};

const text = (value: unknown): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : '';

/** The form for a property as the net worth page has it now. */
export function toForm(line: PropertyLine): PropertyForm {
  const attributes: Record<string, unknown> = line.attributes ?? {};
  return {
    area: text(attributes.area),
    areaUnit: attributes.areaUnit === 'ft2' ? 'ft2' : 'm2',
    yearBuilt: text(attributes.yearBuilt),
    address: text(attributes.address),
    make: text(attributes.make),
    model: text(attributes.model),
    year: text(attributes.year),
    mileage: text(attributes.mileage),
    mileageUnit: attributes.mileageUnit === 'mi' ? 'mi' : 'km',
    debt: line.debt ? `${line.debt.kind}:${line.debt.id}` : '',
    depreciationRate: line.depreciationRate === null ? '' : String(line.depreciationRate),
  };
}

/** The contract's two-decimal check, float noise included (8.2 * 100 is 819.999…). */
const atMostTwoDecimals = (value: number) => Math.abs(Math.round(value * 100) - value * 100) < 1e-6;

const NUMBER_RULES: Record<NumberField, (value: number) => boolean> = {
  area: value => value > 0 && value <= 1_000_000,
  yearBuilt: value => Number.isInteger(value) && value >= 1000 && value <= 2100,
  year: value => Number.isInteger(value) && value >= 1886 && value <= 2100,
  mileage: value => value >= 0 && value <= 10_000_000,
  depreciationRate: value => value > 0 && value <= 100 && atMostTwoDecimals(value),
};

/** Only the fields the drawer shows for this kind. */
const FIELDS_OF: Record<PropertyKind, NumberField[]> = {
  real_estate: ['area', 'yearBuilt'],
  vehicle: ['year', 'mileage', 'depreciationRate'],
};

const parse = (value: string): number | null => {
  const trimmed = value.replace(',', '.').trim();
  return trimmed === '' ? null : Number(trimmed);
};

/** The number fields of this kind that hold something the server would refuse. */
export function invalidFields(form: PropertyForm, kind: PropertyKind): NumberField[] {
  return FIELDS_OF[kind].filter(field => {
    const value = parse(form[field]);
    return value !== null && !(Number.isFinite(value) && NUMBER_RULES[field](value));
  });
}

const compact = (entries: Record<string, string | number | null>) => {
  const kept = Object.fromEntries(
    Object.entries(entries).filter(([, value]) => value !== null && value !== ''),
  );
  return Object.keys(kept).length > 0 ? kept : null;
};

/**
 * The request for exactly what the drawer shows for this kind: a flat never
 * sends a car's fields or a depreciation rate, a unit goes only with its
 * number, and an empty field is left out. Null while a number is invalid.
 */
export function formToBody(form: PropertyForm, kind: PropertyKind): PropertyBody | null {
  if (invalidFields(form, kind).length > 0) return null;
  const [debtKind, debtId] = form.debt.split(':');
  const debt: PropertyBody['debt'] =
    (debtKind === 'wallet' || debtKind === 'liability') && debtId
      ? { kind: debtKind, id: debtId }
      : null;
  if (kind === 'real_estate') {
    const area = parse(form.area);
    return {
      attributes: compact({
        area,
        areaUnit: area === null ? null : form.areaUnit,
        yearBuilt: parse(form.yearBuilt),
        address: form.address.trim(),
      }) as PropertyBody['attributes'],
      debt,
    };
  }
  const mileage = parse(form.mileage);
  return {
    attributes: compact({
      make: form.make.trim(),
      model: form.model.trim(),
      year: parse(form.year),
      mileage,
      mileageUnit: mileage === null ? null : form.mileageUnit,
    }) as PropertyBody['attributes'],
    debt,
    depreciationRate: parse(form.depreciationRate),
  };
}
