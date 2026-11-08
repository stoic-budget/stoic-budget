/**
 * The text of a file whose encoding nobody stated. UTF-8 when the bytes are
 * valid UTF-8 (a byte-order mark is dropped). Otherwise one of the two
 * single-byte code pages older desktop software writes: Windows-1251 when the
 * high bytes run together the way Cyrillic words do, Windows-1252 (what
 * "latin1" means in practice) when they sit alone inside Latin words.
 */
export function decodeUnlabelledText(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder(looksCyrillic(bytes) ? 'windows-1251' : 'windows-1252').decode(bytes);
  }
}

/** Windows-1251 letters below А..я: Ў ў Ґ Ё Є Ї І і ґ ё є ї. */
const CYRILLIC_BELOW = new Set([
  0xa1, 0xa2, 0xa5, 0xa8, 0xaa, 0xaf, 0xb2, 0xb3, 0xb4, 0xb8, 0xba, 0xbf,
]);
const isCyrillicByte = (byte: number) => byte >= 0xc0 || CYRILLIC_BELOW.has(byte);
const isLatinLetter = (byte: number) => (byte | 0x20) >= 0x61 && (byte | 0x20) <= 0x7a;

/**
 * Whether the high-byte runs read as Cyrillic words rather than accents inside
 * Latin ones. A run counts as Cyrillic when it is three bytes or longer, or
 * when no Latin letter touches it ("на", "і", "Ям"); otherwise it is an accent
 * in a Latin word ("Café", "Grüße"). A run without any А..я byte ("¥", "²")
 * counts for neither.
 */
function looksCyrillic(bytes: Uint8Array): boolean {
  let cyrillic = 0;
  let latin = 0;
  let index = 0;
  while (index < bytes.length) {
    if (!isCyrillicByte(bytes[index])) {
      index += 1;
      continue;
    }
    const start = index;
    let letters = false;
    while (index < bytes.length && isCyrillicByte(bytes[index])) {
      letters ||= bytes[index] >= 0xc0;
      index += 1;
    }
    if (!letters) continue;
    const length = index - start;
    if (length >= 3 || !touchesLatinLetter(bytes, start, index)) cyrillic += length;
    else latin += length;
  }
  return cyrillic > latin;
}

/**
 * Whether a Latin letter stands right before or after `[start, end)`. A letter
 * that opens a line is a field code (QIF's `P`, `M`), not part of the word.
 */
function touchesLatinLetter(bytes: Uint8Array, start: number, end: number): boolean {
  const before = start >= 2 && isLatinLetter(bytes[start - 1]) && bytes[start - 2] !== 0x0a;
  return before || (end < bytes.length && isLatinLetter(bytes[end]));
}
