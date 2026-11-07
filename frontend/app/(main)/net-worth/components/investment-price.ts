/** An automatic quote older than this has stopped updating: the source quotes daily. */
const STALE_QUOTE_DAYS = 3;

/** The source failing leaves the old price in place, so only its age tells. */
export function isStaleQuote(
  holding: { priceSource: string; pricedAt: string | null },
  now = new Date(),
): boolean {
  if (holding.priceSource !== 'auto' || !holding.pricedAt) return false;
  return now.getTime() - new Date(holding.pricedAt).getTime() > STALE_QUOTE_DAYS * 86_400_000;
}
