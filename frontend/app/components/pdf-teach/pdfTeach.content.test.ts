import { describe, expect, it } from 'vitest';
import content from './pdfTeach.content';

describe('pdfTeach content', () => {
  it('names the balance tag in every locale by the tag’s own label', () => {
    const { translation } = content.content.status.chainUnknown as unknown as {
      translation: Record<string, string>;
    };
    const locales = Object.keys(
      (content.content.tags.balance as unknown as { translation: Record<string, string> })
        .translation,
    );
    expect(Object.keys(translation).sort()).toEqual(locales.sort());
    for (const locale of locales) {
      // Filled once with `replace`: one {tag}, and no other placeholder.
      expect(translation[locale].match(/\{\w+\}/g), locale).toEqual(['{tag}']);
    }
  });
});
