import type { HoldingLookThrough } from '@/app/lib/contracts';

export type LookThroughDimension = 'sector' | 'region' | 'country';
export const DIMENSIONS: LookThroughDimension[] = ['sector', 'region', 'country'];

/** One line of a fund's breakdown as typed: the weight stays text until it is sent. */
export interface WeightRow {
  key: string;
  weight: string;
}
export type BreakdownDraft = Record<LookThroughDimension, WeightRow[]>;

/** The rest of a fund nobody names; it is shown and sent, never typed. */
export const OTHER = 'other';
const WHOLE = 10_000; // 100% in hundredths of a percent

/**
 * A typed weight as the API takes it, or null: above 0, at most 100, two
 * decimals at most (the contract's own test), a comma read as a point.
 */
export function parseWeight(text: string): number | null {
  const trimmed = text.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const value = Number(trimmed);
  const twoDecimals = Math.abs(Math.round(value * 100) - value * 100) < 1e-6;
  return value > 0 && value <= 100 && twoDecimals ? value : null;
}

export interface RowsCheck {
  /** What is left to 100, in percent; negative when the rows add up to more. */
  remainder: number;
  /** Rows whose name is missing, repeated, or whose weight the API would refuse. */
  invalid: number[];
  over: boolean;
  valid: boolean;
}

/** Hundredths, so 33.33 + 33.33 + 33.34 is exactly 100 here as on the server. */
export function checkRows(rows: WeightRow[]): RowsCheck {
  const seen = new Set<string>();
  const invalid: number[] = [];
  let sum = 0;
  rows.forEach((row, index) => {
    const weight = parseWeight(row.weight);
    if (!row.key || row.key === OTHER || seen.has(row.key) || weight === null) {
      invalid.push(index);
    }
    seen.add(row.key);
    sum += weight === null ? 0 : Math.round(weight * 100);
  });
  const over = sum > WHOLE;
  return { remainder: (WHOLE - sum) / 100, invalid, over, valid: invalid.length === 0 && !over };
}

/** A stored breakdown as rows to edit; its `other` becomes the remainder again. */
export function draftOf(lookThrough: HoldingLookThrough | null): BreakdownDraft {
  const rows = (dimension: LookThroughDimension): WeightRow[] =>
    (lookThrough?.[dimension] ?? [])
      .filter(row => row.key !== OTHER)
      .map(row => ({ key: row.key, weight: String(row.weight) }));
  return { sector: rows('sector'), region: rows('region'), country: rows('country') };
}

/**
 * The weights to send for one dimension: the rows as typed and, when they
 * leave a part, that part as `other`. Exactly what the editor shows.
 */
export function weightsOf(rows: WeightRow[]): Array<{ key: string; weight: number }> | null {
  if (rows.length === 0) return null;
  const { remainder } = checkRows(rows);
  const weights = rows.map(row => ({ key: row.key, weight: parseWeight(row.weight) ?? 0 }));
  return remainder > 0 ? [...weights, { key: OTHER, weight: remainder }] : weights;
}

/** The breakdown to send for a fund: each dimension as shown, null when none has lines. */
export function lookThroughOf(draft: BreakdownDraft) {
  const sector = weightsOf(draft.sector);
  const region = weightsOf(draft.region);
  const country = weightsOf(draft.country);
  return sector || region || country ? { sector, region, country } : null;
}
