import type { AssetBasis } from './crypto-lots';

const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * Gains realised on assets no priced holding carries: coins sold to the last
 * unit, and coins still held that no price source knows (#655). A held,
 * priced coin carries its own realised gain, so it is left out here.
 * `closedBasisIncomplete`: one of them had a disposal with no purchase
 * behind it, so its gain is partial.
 */
export function closedGains(
  basis: ReadonlyMap<string, AssetBasis>,
  shown: ReadonlySet<string>,
): { realizedClosed: number; closedBasisIncomplete: boolean } {
  const closed = [...basis.values()].filter(asset => !shown.has(asset.asset));
  return {
    realizedClosed: round2(closed.reduce((sum, asset) => sum + (asset.realized ?? 0), 0)),
    closedBasisIncomplete: closed.some(asset => asset.incomplete && asset.realized !== 0),
  };
}
