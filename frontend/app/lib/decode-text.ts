/**
 * Twin of the backend's `parsing/helpers/text-encoding.helper.ts`: the import
 * wizard reads the file in the browser and must decode it the same way.
 */
/**
 * The text of a file whose encoding nobody stated. UTF-8 when the bytes are
 * valid UTF-8 (a byte-order mark is dropped). Otherwise one of the two
 * single-byte code pages older desktop software writes: Windows-1251 when the
 * high bytes run together the way Cyrillic words do, Windows-1252 (what
 * "latin1" means in practice) when they sit alone inside Latin words.
 * UTF-16 first, by its byte-order mark or, without one, by the zero byte of
 * every ASCII character (Excel's "Unicode text" export).
 */
export function decodeUnlabelledText(bytes: Uint8Array): string {
  const wide = utf16Of(bytes);
  if (wide) {
    return new TextDecoder(wide).decode(bytes);
  }
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
 * Latin ones. A run counts as Cyrillic when it is three bytes or longer, or two
 * with no Latin letter touching it ("на", "Ям"); a run a Latin letter touches
 * is an accent in a Latin word ("Café", "Grüße"). A lone byte on its own is
 * either "і" or "à" ("Livraison à domicile", "Pagato è ok"), so it counts for
 * neither, and neither does a run without any А..я byte ("¥", "²"). Without
 * evidence either way the text is read as Windows-1252.
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
    const touchesLatin = touchesLatinLetter(bytes, start, index);
    if (length >= 3 || (length === 2 && !touchesLatin)) cyrillic += length;
    else if (touchesLatin) latin += length;
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

/**
 * UTF-16 by its mark (the decoder drops it), or by zero bytes on one side of
 * the pairs (every ASCII character has one) and almost none on the other.
 * Single-byte text never holds a zero, so a quarter is plenty even for text
 * that is mostly Cyrillic.
 */
function utf16Of(bytes: Uint8Array): 'utf-16le' | 'utf-16be' | null {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return 'utf-16le';
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return 'utf-16be';
  }
  const sample = bytes.subarray(0, Math.min(bytes.length, 512) & ~1);
  if (sample.length < 4) {
    return null;
  }
  let lowZeros = 0;
  let highZeros = 0;
  for (let index = 0; index < sample.length; index += 2) {
    if (sample[index + 1] === 0) lowZeros++;
    if (sample[index] === 0) highZeros++;
  }
  const pairs = sample.length / 2;
  if (lowZeros > pairs * 0.25 && highZeros < pairs * 0.02) {
    return 'utf-16le';
  }
  if (highZeros > pairs * 0.25 && lowZeros < pairs * 0.02) {
    return 'utf-16be';
  }
  return null;
}
