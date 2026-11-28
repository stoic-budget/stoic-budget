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
 * for an ending: "сигарету" finds "сигареты", "beers" finds "beer".
 */
function wordMatches(word: string, query: string): boolean {
  if (word.startsWith(query)) {
    return true;
  }
  if (word.length >= 5 && query.startsWith(word.slice(0, -2))) {
    return true;
  }
  return query.length >= 5 && word.startsWith(query.slice(0, -2));
}

/** 0 the whole text, 1 its start, 2 the start of a word in it, 3 anywhere; null no match. */
function textScore(text: string, query: string): number | null {
  if (text === query) {
    return 0;
  }
  if (text.startsWith(query)) {
    return 1;
  }
  if (text.split(/[\s-]+/).some(word => wordMatches(word, query))) {
    return 2;
  }
  return text.includes(query) ? 3 : null;
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
      score = best(score, 4);
    }
    if (byGroup.has(name)) {
      score = best(score, 5);
    }
    if (score !== null) {
      scored.push({ name, score, at });
    }
  });
  return scored.sort((a, b) => a.score - b.score || a.at - b.at).map(entry => entry.name);
}
