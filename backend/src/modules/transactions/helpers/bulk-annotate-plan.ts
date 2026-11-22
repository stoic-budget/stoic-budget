/**
 * Where a bulk comment goes on one row. A row keeps one comment field (the
 * drawer edits it on a single line), so a new comment is appended after the
 * old one rather than replacing it: nobody loses what they wrote earlier.
 */
export const NOTE_SEPARATOR = ' · ';

/** What the row's Comment field takes (its input and the split part contract). */
export const COMMENT_MAX_LENGTH = 1000;

/**
 * The row's comment with `note` added, or null when nothing changes: an empty
 * note, or a comment that already ends with it. The second case makes a
 * repeated request (a double click, a retry) a no-op instead of a second copy.
 */
export function appendNote(existing: string | null, note: string): string | null {
  const text = note.trim();
  if (!text) {
    return null;
  }
  const current = (existing ?? '').trimEnd();
  if (!current) {
    return text;
  }
  if (current === text || current.endsWith(`${NOTE_SEPARATOR}${text}`)) {
    return null;
  }
  return `${current}${NOTE_SEPARATOR}${text}`;
}

/** The tags of `wanted` a row does not carry yet, each once. */
export function tagsToAdd(current: readonly string[], wanted: readonly string[]): string[] {
  const have = new Set(current);
  return [...new Set(wanted)].filter(id => !have.has(id));
}
