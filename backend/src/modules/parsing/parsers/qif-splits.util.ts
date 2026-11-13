import type { ParsedSplit } from '../interfaces/parsed-statement.interface';

/** One S/E/$ group of a QIF record, as written. */
export interface RawSplit {
  category?: string;
  memo?: string;
  amount?: string;
}

/** A split part the file sent to another of its accounts, signed as the row is. */
export interface TransferPart {
  amount: number;
  transferAccount: string;
  memo?: string;
}

export interface SplitReading {
  /** What is left of the row once its transfer parts are cut out, signed. */
  rest: number;
  /** The parts of what is left, positive. */
  parts: ParsedSplit[];
  /** Parts that become rows of their own, so pairing can match them. */
  transfers: TransferPart[];
}

export const parseAmount = (value: string | undefined) =>
  Number.parseFloat((value ?? '').replace(/,/g, ''));

const round2 = (value: number) => Math.round(value * 100) / 100;

const money = (value: number) => Math.abs(value).toFixed(2);

const sumOf = (parts: { amount: number }[]) =>
  round2(parts.reduce((acc, part) => acc + part.amount, 0));

/**
 * An `L` or `S` value: `[Savings]` is a transfer to that account, anything else
 * a category whose levels are joined by ':'. A `/Class` suffix is dropped, and
 * so is the `--Split--` placeholder some programs write on a split row.
 */
export function readQifCategory(value: string | undefined): {
  categoryName?: string;
  transferAccount?: string;
} {
  const transfer = /^\s*\[([^\]]*)\]/.exec(value ?? '');
  if (transfer) {
    const account = transfer[1].trim();
    return account ? { transferAccount: account } : {};
  }
  const levels = (value ?? '')
    .split('/')[0]
    .split(':')
    .map(level => level.trim())
    .filter(Boolean);
  const name = levels.join(':');
  return name && name !== '--Split--' ? { categoryName: name } : {};
}

/**
 * The split parts of a row whose amount is `total`. A part sent to another
 * account (`[Account]`) is cut out to be a row of its own: as a split part it
 * would count as spending and never pair with its other leg. The parts left
 * must go the way of what is left of the row; when they fall short of it, the
 * rest becomes a part without a category. Parts that cannot make up the row
 * leave it whole. Either case is said in `warnings`.
 */
export function readSplits(
  raw: RawSplit[],
  total: number,
  label: string,
  warnings: string[],
): SplitReading | undefined {
  let parts = raw
    .map(split => ({
      amount: parseAmount(split.amount),
      ...readQifCategory(split.category),
      ...(split.memo ? { memo: split.memo } : {}),
    }))
    .filter(part => Number.isFinite(part.amount) && Math.abs(part.amount) >= 0.005);
  if (parts.length === 0) return undefined;
  // Some programs write every part unsigned: parts that all go against the row
  // cannot make it up as written, so they are read the row's way.
  if (total !== 0 && parts.every(part => Math.sign(part.amount) === -Math.sign(total))) {
    parts = parts.map(part => ({ ...part, amount: -part.amount }));
  }
  const transfers = parts.filter((part): part is TransferPart => Boolean(part.transferAccount));
  const others = parts.filter(part => !part.transferAccount);
  const rest = round2(total - sumOf(transfers));
  const left = round2(rest - sumOf(others));
  const way = Math.sign(rest);
  const fits =
    way === 0
      ? others.length === 0
      : others.every(part => Math.sign(part.amount) === way) && Math.sign(left) !== -way;
  if (!fits) {
    const mixed = parts.some(part => part.amount > 0) && parts.some(part => part.amount < 0);
    warnings.push(
      mixed
        ? `${label}: its split parts go both in and out; the row is kept whole`
        : `${label}: its split parts add up to ${money(sumOf(parts))}, more than the row's ${money(total)}; the row is kept whole`,
    );
    return undefined;
  }
  if (Math.abs(left) >= 0.005) {
    warnings.push(
      `${label}: its split parts add up to ${money(sumOf(parts))} of ${money(total)}; the remaining ${money(left)} is kept as a part without a category`,
    );
    others.push({ amount: left });
  }
  return {
    rest,
    parts: others.map(part => ({ ...part, amount: Math.abs(part.amount) })),
    transfers,
  };
}
