import { AddRuleGroupsAndNotifyMarks1788190000000 } from '@/migrations/1788190000000-AddRuleGroupsAndNotifyMarks';
import type { QueryRunner } from 'typeorm';

describe('AddRuleGroupsAndNotifyMarks1788190000000', () => {
  const run = async (step: 'up' | 'down') => {
    const query = vi.fn().mockResolvedValue(undefined);
    await new AddRuleGroupsAndNotifyMarks1788190000000()[step]({
      query,
    } as unknown as QueryRunner);
    return query.mock.calls.map(([sql]) => String(sql).replace(/\s+/g, ' ').trim());
  };

  it('creates the folders table scoped to a workspace, and is safe to run twice', async () => {
    const sql = await run('up');
    const folders = sql.find(statement => statement.includes('"rule_groups" ('));

    expect(folders).toContain('CREATE TABLE IF NOT EXISTS "rule_groups"');
    expect(folders).toContain(
      '"workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE',
    );
    expect(folders).toContain('"position" integer NOT NULL DEFAULT 0');
    expect(sql.every(statement => /IF (NOT )?EXISTS/.test(statement))).toBe(true);
  });

  it('lets a rule sit in a folder that, once deleted, leaves the rule outside any', async () => {
    const sql = await run('up');

    expect(sql).toContain(
      'ALTER TABLE "categorization_rules" ADD COLUMN IF NOT EXISTS "group_id" uuid REFERENCES "rule_groups"("id") ON DELETE SET NULL',
    );
  });

  it('keys the notify marks on the rule and the row, gone with the rule or the workspace', async () => {
    const sql = await run('up');
    const marks = sql.find(statement => statement.includes('"rule_notify_marks" ('));

    expect(marks).toContain('PRIMARY KEY ("rule_id", "row_key")');
    expect(marks).toContain(
      '"rule_id" uuid NOT NULL REFERENCES "categorization_rules"("id") ON DELETE CASCADE',
    );
    expect(marks).toContain(
      '"workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE',
    );
  });

  it('drops the marks, the column and the folders, in that order, on the way down', async () => {
    const sql = await run('down');

    expect(sql).toEqual([
      'DROP TABLE IF EXISTS "rule_notify_marks"',
      'DROP INDEX IF EXISTS "IDX_categorization_rules_group"',
      'ALTER TABLE "categorization_rules" DROP COLUMN IF EXISTS "group_id"',
      'DROP TABLE IF EXISTS "rule_groups"',
    ]);
  });
});
