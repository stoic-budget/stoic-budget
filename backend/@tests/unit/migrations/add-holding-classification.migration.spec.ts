import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

describe('AddHoldingClassification migration', () => {
  const filePath = path.join(
    process.cwd(),
    'src',
    'migrations',
    '1788310000000-AddHoldingClassification.ts',
  );
  const source = () => readFileSync(filePath, 'utf8');
  const up = () => source().slice(0, source().indexOf('public async down'));
  const down = () => source().slice(source().indexOf('public async down'));

  it('adds the four columns idempotently and backfills nothing', () => {
    expect(existsSync(filePath)).toBe(true);
    for (const column of ['sector', 'region', 'country', 'look_through']) {
      expect(up()).toContain(`ADD COLUMN IF NOT EXISTS "${column}"`);
    }
    expect(up()).toContain('"look_through" jsonb');
    expect(up()).not.toMatch(/UPDATE "investment_holdings"|INSERT INTO/);
  });

  it('keeps out a country that is not two capitals and a breakdown that is not an object', () => {
    expect(up()).toContain('CHK_investment_holdings_country');
    expect(up()).toContain(`"country" ~ '^[A-Z]{2}$'`);
    expect(up()).toContain(`jsonb_typeof("look_through") = 'object'`);
    expect(up().match(/EXCEPTION WHEN duplicate_object/g)).toHaveLength(2);
  });

  it('drops the checks before the columns', () => {
    const text = down();
    expect(text.indexOf('CHK_investment_holdings_country')).toBeLessThan(
      text.indexOf('DROP COLUMN IF EXISTS "country"'),
    );
    expect(text).toContain('DROP COLUMN IF EXISTS "look_through"');
  });
});
