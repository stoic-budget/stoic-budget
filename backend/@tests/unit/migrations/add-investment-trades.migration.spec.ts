import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

describe('AddInvestmentTrades migration', () => {
  const filePath = path.join(
    process.cwd(),
    'src',
    'migrations',
    '1788290000000-AddInvestmentTrades.ts',
  );
  const source = () => readFileSync(filePath, 'utf8');
  const up = () => source().slice(0, source().indexOf('public async down'));
  const down = () => source().slice(source().indexOf('public async down'));

  it('creates the table idempotently and backfills nothing', () => {
    expect(existsSync(filePath)).toBe(true);
    expect(up()).toContain('CREATE TABLE IF NOT EXISTS "investment_trades"');
    expect(up()).toContain('EXCEPTION WHEN duplicate_object');
    expect(up()).not.toMatch(/INSERT INTO|UPDATE "investment_holdings"/);
  });

  it('goes with its workspace and holding, and outlives the linked row', () => {
    expect(up()).toContain('REFERENCES "workspaces"("id") ON DELETE CASCADE');
    expect(up()).toContain('REFERENCES "investment_holdings"("id") ON DELETE CASCADE');
    expect(up()).toContain('REFERENCES "transactions"("id") ON DELETE SET NULL');
  });

  it('checks the fields each kind uses', () => {
    for (const name of [
      'CHK_investment_trades_non_negative',
      'CHK_investment_trades_units',
      'CHK_investment_trades_dividend',
      'CHK_investment_trades_split',
      'CHK_investment_trades_acquired_on',
    ]) {
      expect(up()).toContain(name);
    }
  });

  it('indexes the workspace, holding and date, and the foreign keys', () => {
    expect(up()).toContain('("workspace_id", "holding_id", "trade_date")');
    expect(up()).toContain('IDX_investment_trades_holding');
    expect(up()).toContain('IDX_investment_trades_transaction');
  });

  it('drops the indexes, then the table, then the type', () => {
    const text = down();
    expect(text.indexOf('IDX_investment_trades_workspace_holding_date')).toBeLessThan(
      text.indexOf('DROP TABLE'),
    );
    expect(text.indexOf('DROP TABLE')).toBeLessThan(text.indexOf('DROP TYPE'));
  });
});
