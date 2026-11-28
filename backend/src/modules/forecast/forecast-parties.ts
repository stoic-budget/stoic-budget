/**
 * Whether two counterparty names mean the same payer or payee: the shorter
 * one's words open the longer one ("WeWork" / "WeWork Kurfürstendamm"),
 * ignoring case, accents and punctuation.
 */
export function sameParty(a: string, b: string): boolean {
  const left = partyWords(a);
  const right = partyWords(b);
  if (left.length === 0 || right.length === 0) return false;
  const [short, long] = left.length <= right.length ? [left, right] : [right, left];
  return short.every((word, index) => long[index] === word);
}

function partyWords(name: string): string[] {
  return name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}
