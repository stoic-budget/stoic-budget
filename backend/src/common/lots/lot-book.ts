/**
 * Open lots of one asset, and the two rules for taking from them.
 *
 * Shared by the crypto cost basis (coins, always first in, first out) and the
 * investment trades (shares, first in first out or average cost). Pure: the
 * caller owns the array of lots and every function here changes it in place,
 * so a replay of events is one loop over plain data that a test can read.
 */

export type LotMethod = 'fifo' | 'average';

export interface Lot {
  quantity: number;
  unitCost: number;
  /** ISO date the lot was acquired; FIFO takes the oldest first. */
  date: string;
  /** What created the lot (a trade id), when the caller tracks one. */
  ref?: string;
}

/** One lot's share of a disposal. */
export interface LotPiece {
  quantity: number;
  unitCost: number;
  date: string;
  ref?: string;
}

export interface Taken {
  /** Quantity some lot backed; less than asked when the lots ran out. */
  matched: number;
  /** What the matched quantity had cost. */
  cost: number;
  /** Acquisition date of the oldest lot taken from; null when none was. */
  oldest: string | null;
  pieces: LotPiece[];
  /** Asked for but backed by no lot. */
  uncovered: number;
}

/** Below this a lot is spent: decimal columns keep 8 places, floats a little less. */
export const LOT_EPSILON = 1e-9;

/**
 * Float noise a coin's lots ignore. Coins are counted to 18 places (wei), so
 * anything above this is real; shares pass `LOT_EPSILON` instead.
 */
const COIN_DUST = 1e-18;

/**
 * Adds a lot in acquisition order. A lot brought in from elsewhere can be older
 * than the ones already held, and FIFO is about when it was bought, not when it
 * was entered. Equal dates keep the order they were added in.
 */
export function addLot(lots: Lot[], lot: Lot): void {
  let index = lots.length;
  while (index > 0 && lots[index - 1].date > lot.date) {
    index -= 1;
  }
  lots.splice(index, 0, lot);
}

export function heldQuantity(lots: readonly Lot[]): number {
  return lots.reduce((sum, lot) => sum + lot.quantity, 0);
}

export function heldCost(lots: readonly Lot[]): number {
  return lots.reduce((sum, lot) => sum + lot.quantity * lot.unitCost, 0);
}

/**
 * Takes `quantity` out of the lots.
 * - FIFO empties the oldest lot first.
 * - Average cost takes the same share of every lot, so each sale costs the
 *   pool's average and what stays keeps that average: the weighted-average
 *   method without losing the lots' dates.
 */
export function takeFromLots(
  lots: Lot[],
  quantity: number,
  method: LotMethod,
  dust = COIN_DUST,
): Taken {
  return method === 'average' ? takeAverage(lots, quantity) : takeFifo(lots, quantity, dust);
}

/** `dust`: what is left of a lot (or of the sale) below it is float noise, not a lot. */
function takeFifo(lots: Lot[], quantity: number, dust: number): Taken {
  let left = quantity;
  let matched = 0;
  let cost = 0;
  let oldest: string | null = null;
  const pieces: LotPiece[] = [];
  while (left > dust && lots.length > 0) {
    const lot = lots[0];
    const taken = Math.min(lot.quantity, left);
    pieces.push({ quantity: taken, unitCost: lot.unitCost, date: lot.date, ref: lot.ref });
    matched += taken;
    cost += taken * lot.unitCost;
    oldest = oldest ?? lot.date;
    lot.quantity -= taken;
    left -= taken;
    if (lot.quantity <= dust) {
      lots.shift();
    }
  }
  return { matched, cost, oldest, pieces, uncovered: left > dust ? left : 0 };
}

function takeAverage(lots: Lot[], quantity: number): Taken {
  const held = heldQuantity(lots);
  if (held <= 0) {
    return { matched: 0, cost: 0, oldest: null, pieces: [], uncovered: quantity };
  }
  const matched = Math.min(quantity, held);
  // Everything goes when the sale is the whole pool, whatever the float dust says.
  const share = held - matched <= LOT_EPSILON ? 1 : matched / held;
  let cost = 0;
  const pieces: LotPiece[] = [];
  for (const lot of lots) {
    const taken = lot.quantity * share;
    pieces.push({ quantity: taken, unitCost: lot.unitCost, date: lot.date, ref: lot.ref });
    cost += taken * lot.unitCost;
    lot.quantity -= taken;
  }
  const oldest = lots.length > 0 ? lots[0].date : null;
  const kept = lots.filter(lot => lot.quantity > LOT_EPSILON);
  lots.splice(0, lots.length, ...kept);
  const uncovered = quantity - matched;
  return { matched, cost, oldest, pieces, uncovered: uncovered > 1e-18 ? uncovered : 0 };
}

/**
 * A split: every open lot holds `factor` times the units at `1 / factor` the
 * unit cost, so what the lots cost does not change. 3-for-1 is a factor of 3,
 * a 1-for-10 reverse split 0.1.
 */
export function splitLots(lots: Lot[], factor: number): void {
  for (const lot of lots) {
    lot.quantity *= factor;
    lot.unitCost /= factor;
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days from one ISO date to another, never negative. */
export function daysBetween(from: string, to: string): number {
  const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS;
  return Number.isFinite(days) ? Math.max(Math.round(days), 0) : 0;
}
