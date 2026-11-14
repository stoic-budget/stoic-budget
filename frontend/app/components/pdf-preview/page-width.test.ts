import { describe, expect, it } from 'vitest';
import { pdfPageWidth, TEACH_PAGE_WIDTH } from './page-width';

describe('pdfPageWidth', () => {
  it('fits a phone inside its gutters, and draws a page being marked readable', () => {
    expect(pdfPageWidth(390, false)).toBe(350);
    expect(pdfPageWidth(390, true)).toBe(TEACH_PAGE_WIDTH);
    expect(pdfPageWidth(639, true)).toBe(TEACH_PAGE_WIDTH);
  });

  it('keeps wider screens as they were, marking or not', () => {
    for (const teaching of [false, true]) {
      expect(pdfPageWidth(640, teaching)).toBe(520);
      expect(pdfPageWidth(1000, teaching)).toBe(880);
      expect(pdfPageWidth(1600, teaching)).toBe(1080);
    }
  });
});
