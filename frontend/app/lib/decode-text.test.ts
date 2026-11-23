import { describe, expect, it } from 'vitest';
import { decodeUnlabelledText } from './decode-text';

/** Windows-1251 bytes for А..я, ASCII as is. */
const cp1251 = (text: string) =>
  Uint8Array.from(
    [...text].map(char => {
      const code = char.charCodeAt(0);
      return code >= 0x410 && code <= 0x44f ? code - 0x410 + 0xc0 : code;
    }),
  );

describe('decodeUnlabelledText (wizard)', () => {
  it('reads UTF-8, Windows-1251, Latin-1 and UTF-16 the way the server does (#637)', () => {
    expect(decodeUnlabelledText(new TextEncoder().encode('Магазин Пример'))).toBe('Магазин Пример');
    expect(decodeUnlabelledText(cp1251('Дата;Покупка;-10,00'))).toBe('Дата;Покупка;-10,00');
    // Latin-1: a lone high byte inside a Latin word is Windows-1252, not "Mьller".
    expect(decodeUnlabelledText(Uint8Array.from([0x4d, 0xfc, 0x6c, 0x6c, 0x65, 0x72]))).toBe(
      'Müller',
    );
    const wide = new Uint8Array([0xff, 0xfe, 0x4d, 0, 0xfc, 0, 0x6c, 0, 0x6c, 0, 0x65, 0, 0x72, 0]);
    expect(decodeUnlabelledText(wide)).toBe('Müller');
  });
});
