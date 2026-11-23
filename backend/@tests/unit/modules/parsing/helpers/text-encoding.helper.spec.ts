import { decodeUnlabelledText } from '@/modules/parsing/helpers/text-encoding.helper';

/** Windows-1251 bytes, built from the decoder's own table. */
const cp1251Table = new Map(
  Array.from({ length: 128 }, (_, index) => [
    new TextDecoder('windows-1251').decode(Uint8Array.of(0x80 + index)),
    0x80 + index,
  ]),
);
const cp1251 = (text: string) =>
  Uint8Array.from([...text].map(char => cp1251Table.get(char) ?? char.charCodeAt(0)));

/** Windows-1252 for the Latin-1 range, which is the same byte. */
const cp1252 = (text: string) => Uint8Array.from([...text].map(char => char.charCodeAt(0)));

describe('decodeUnlabelledText', () => {
  it('reads UTF-16 with and without its byte-order mark (#637)', () => {
    const text = 'Дата;Описание;Сумма\n02.03.2026;Müller;-10,00';
    const le = Buffer.from(text, 'utf16le');
    const be = Buffer.from(le).swap16();
    expect(decodeUnlabelledText(Uint8Array.from([0xff, 0xfe, ...le]))).toBe(text);
    expect(decodeUnlabelledText(Uint8Array.from([0xfe, 0xff, ...be]))).toBe(text);
    expect(decodeUnlabelledText(le)).toBe(text);
    expect(decodeUnlabelledText(be)).toBe(text);
    // Mostly Cyrillic, no mark: only spaces and digits carry a zero byte.
    const cyrillic = 'Покупка в магазине Пример 10,00';
    expect(decodeUnlabelledText(Buffer.from(cyrillic, 'utf16le'))).toBe(cyrillic);
  });

  it('reads valid UTF-8 as UTF-8 and drops the byte-order mark', () => {
    const text = 'Магазин Пример, Café';
    expect(decodeUnlabelledText(new TextEncoder().encode(`﻿${text}`))).toBe(text);
  });

  it('reads Cyrillic Windows-1251', () => {
    const text = 'Оплата за услуги, ACME Store';
    expect(decodeUnlabelledText(cp1251(text))).toBe(text);
  });

  it('reads accented Latin as Windows-1252', () => {
    const text = 'Café Exemple, Grüße aus München';
    expect(decodeUnlabelledText(cp1252(text))).toBe(text);
  });

  it('reads Cyrillic of short words as Windows-1251', () => {
    const text = 'PОАО Ям\nMВ ТЦ на ул\n';
    expect(decodeUnlabelledText(cp1251(text))).toBe(text);
  });

  it('reads Ukrainian, whose і ї є sit below А..я, as Windows-1251', () => {
    const text = 'PКиїв кіно їжа\nMХліб і сіль, Євген\n';
    expect(decodeUnlabelledText(cp1251(text))).toBe(text);
  });

  it('keeps Windows-1252 signs that are not letters out of the guess', () => {
    const text = 'PCafé Exemple\nMRoom 12 m², ¥500\n';
    expect(decodeUnlabelledText(cp1252(text))).toBe(text);
  });

  it('reads a lone accented word between Latin ones as Windows-1252', () => {
    for (const text of ['Livraison à domicile', 'Pagato è ok', 'PLivraison à domicile\nMPagato è ok\n']) {
      expect(decodeUnlabelledText(cp1252(text))).toBe(text);
    }
  });

  it('reads a single short Cyrillic word as Windows-1251', () => {
    for (const text of ['Еда', 'PЕда\n', 'MЎсё\n', 'Ям']) {
      expect(decodeUnlabelledText(cp1251(text))).toBe(text);
    }
  });
});
