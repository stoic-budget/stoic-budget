import { stripDiacritics } from '../../../common/utils/payee-key.util';

/**
 * Text as a rule compares it: case, accents and runs of whitespace do not
 * matter, since banks print the same payee as "CAFÉ  DE LA GARE" and "Cafe de
 * la gare". Not trimmed: a condition may end in a space to ask for a whole word.
 */
export function normalizeRuleText(value: unknown): string {
  return stripDiacritics(String(value).toLowerCase()).replace(/\s+/g, ' ');
}
