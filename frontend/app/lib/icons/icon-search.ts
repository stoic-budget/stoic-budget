/**
 * Finding an icon by what the user types: its English name and Lucide's
 * English search words, its translated name where the app has one, and the
 * words of the groups it belongs to in the user's language (and English).
 * Pure: the picker hands in what it has loaded.
 */

export interface IconSearchGroup {
  icons: readonly string[];
  /** The group's name and words, lower-cased, in the user's language and English. */
  terms: readonly string[];
}

export interface IconSearchIndex {
  /** Every icon, in the order the picker lists them without a query. */
  order: readonly string[];
  words: Readonly<Record<string, readonly string[]>>;
  /** Translated icon names, lower-cased. */
  labels: ReadonlyMap<string, string>;
  groups: readonly IconSearchGroup[];
}

/** Grouped icons first, in group order, then the rest alphabetically. */
export function listingOrder(names: readonly string[], groups: readonly IconSearchGroup[]) {
  const known = new Set(names);
  const seen = new Set<string>();
  const order: string[] = [];
  for (const name of groups.flatMap(group => group.icons)) {
    if (known.has(name) && !seen.has(name)) {
      seen.add(name);
      order.push(name);
    }
  }
  for (const name of [...names].sort()) {
    if (!seen.has(name)) {
      order.push(name);
    }
  }
  return order;
}

/** Splits a group's comma-separated words into lower-cased terms. */
export function groupTerms(line: string | undefined, locale: string): string[] {
  return (line ?? '')
    .split(',')
    .map(term => term.trim().toLocaleLowerCase(locale))
    .filter(Boolean);
}

/**
 * A typed word finds a written one when one starts with the other, allowing
 * for an ending: "сигарету" and "сигаретами" find "сигареты", "beers" finds
 * "beer". Short words must match from the start, or "beers" would find "beef".
 */
function wordMatches(word: string, query: string): boolean {
  if (word.startsWith(query)) {
    return true;
  }
  // A longer form of the word: a plural, a case ending.
  if (word.length >= 4 && query.startsWith(word)) {
    return true;
  }
  // Another ending of the same length or so: "сигарету" for "сигареты".
  if (word.length >= 5 && query.length >= word.length - 2 && query.startsWith(word.slice(0, -2))) {
    return true;
  }
  // A longer ending than the word has: "сигаретами" for "сигареты".
  return query.length >= 6 && word.startsWith(query.slice(0, -2));
}

/**
 * How well a match fits, lower first: the name itself, its start, the start of
 * a word in it, then a group the user named in their own language, then one of
 * Lucide's English search words, then the letters anywhere in the name. A
 * group outranks the last two: "rent" means the home group, not "parentheses".
 */
const SCORE = { exact: 0, start: 1, word: 2, group: 3, searchWord: 4, inside: 5 } as const;

function textScore(text: string, query: string): number | null {
  if (text === query) {
    return SCORE.exact;
  }
  if (text.startsWith(query)) {
    return SCORE.start;
  }
  if (text.split(/[\s-]+/).some(word => wordMatches(word, query))) {
    return SCORE.word;
  }
  return text.includes(query) ? SCORE.inside : null;
}

function termMatches(term: string, query: string): boolean {
  return term.startsWith(query) || term.split(/\s+/).some(word => wordMatches(word, query));
}

const best = (a: number | null, b: number | null) =>
  a === null ? b : b === null ? a : Math.min(a, b);

/** The icons that match `query`, best first; every icon for an empty query. */
export function searchIcons(index: IconSearchIndex, query: string, locale: string): string[] {
  const needle = query.trim().toLocaleLowerCase(locale);
  if (!needle) {
    return [...index.order];
  }
  const byGroup = new Set(
    index.groups
      .filter(group => group.terms.some(term => termMatches(term, needle)))
      .flatMap(group => group.icons),
  );
  const scored: Array<{ name: string; score: number; at: number }> = [];
  index.order.forEach((name, at) => {
    let score = best(textScore(name.replace(/-/g, ' '), needle), textScore(name, needle));
    const label = index.labels.get(name);
    if (label) {
      score = best(score, textScore(label, needle));
    }
    if ((index.words[name] ?? []).some(word => termMatches(word, needle))) {
      score = best(score, SCORE.searchWord);
    }
    if (byGroup.has(name)) {
      score = best(score, SCORE.group);
    }
    if (score !== null) {
      scored.push({ name, score, at });
    }
  });
  return scored.sort((a, b) => a.score - b.score || a.at - b.at).map(entry => entry.name);
}
