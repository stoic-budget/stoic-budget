import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Advice no analyzer writes any more: expert cards, now Stoic reflections, types
 * nothing has ever produced, and hand-written rows with no key, which cannot be
 * shown in the reader's language. Every kept row is computed afresh from
 * transactions, so these need no way back.
 */
export class RetireNonStoicInsights1788120000000 implements MigrationInterface {
  name = 'RetireNonStoicInsights1788120000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "insights"
      WHERE "message_key" IS NULL
         OR "category" IN ('expert', 'anomaly', 'workflow')
         OR "type" IN (
           'expert.principle', 'rule.suggestion', 'pattern.detected', 'spending.spike',
           'transaction.unusual', 'counterparty.new', 'trend.spending_down',
           'forecast.monthly', 'workflow.unused_rules', 'workflow.classification_accuracy',
           'workflow.tip', 'ai.summary'
         )
    `);
  }

  public async down(): Promise<void> {
    // Nothing to restore: the rows are derived data.
  }
}
