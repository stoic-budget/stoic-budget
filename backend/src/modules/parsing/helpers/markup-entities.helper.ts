const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

/**
 * Decodes the character references an OFX (SGML) or camt (XML) file writes.
 * One pass, so '&amp;lt;' becomes the text '&lt;' rather than being decoded
 * twice into '<'.
 */
export function decodeEntities(value: string): string {
  return value.replace(/&(?:#(\d+)|(amp|lt|gt|quot|apos));/g, (_, code, name) =>
    code ? String.fromCharCode(Number(code)) : NAMED_ENTITIES[name],
  );
}
