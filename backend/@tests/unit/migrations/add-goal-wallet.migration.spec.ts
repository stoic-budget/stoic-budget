import { readFileSync } from 'node:fs';
import path from 'node:path';
import { AddGoalWallet1788520000000 } from '../../../src/migrations/1788520000000-AddGoalWallet';

const source = readFileSync(
  path.join(process.cwd(), 'src', 'migrations', '1788520000000-AddGoalWallet.ts'),
  'utf8',
);

function run(direction: 'up' | 'down'): Promise<string[]> {
  const queries: string[] = [];
  const queryRunner = { query: vi.fn(async (sql: string) => queries.push(sql)) };
  const migration = new AddGoalWallet1788520000000();
  return migration[direction](queryRunner as never).then(() => queries);
}

describe('AddGoalWallet migration', () => {
  it('adds a nullable wallet link that a deleted account sets back to NULL', async () => {
    const queries = await run('up');
    const sql = queries.join('\n');
    const addColumn = queries.find(query => query.includes('ADD COLUMN')) ?? '';
    expect(addColumn).toContain('ADD COLUMN IF NOT EXISTS "wallet_id" uuid');
    expect(addColumn).not.toContain('NOT NULL');
    expect(sql).toMatch(/FOREIGN KEY \("wallet_id"\) REFERENCES "wallets"\("id"\) ON DELETE SET NULL/);
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS "IDX_goals_wallet"');
  });

  it('can run twice: the constraint is dropped before it is added again', async () => {
    const queries = await run('up');
    const drop = queries.findIndex(sql => sql.includes('DROP CONSTRAINT IF EXISTS "FK_goals_wallet"'));
    const add = queries.findIndex(sql => sql.includes('ADD CONSTRAINT "FK_goals_wallet"'));
    expect(drop).toBeGreaterThanOrEqual(0);
    expect(drop).toBeLessThan(add);
  });

  it('touches no existing goal', () => {
    expect(source).not.toMatch(/UPDATE\s+"goals"/);
  });

  it('reverses itself', async () => {
    const sql = (await run('down')).join('\n');
    expect(sql).toContain('DROP INDEX IF EXISTS "IDX_goals_wallet"');
    expect(sql).toContain('DROP CONSTRAINT IF EXISTS "FK_goals_wallet"');
    expect(sql).toContain('DROP COLUMN IF EXISTS "wallet_id"');
  });
});
