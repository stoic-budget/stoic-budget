import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Who gave a transaction its payee when it was not the descriptor's own alias:
 * `manual` for a person, `rule` for a categorization rule. A rule never
 * replaces a payee a person picked, and until now nothing told the two apart.
 *
 * Rows a person re-assigned before are marked from the audit trail, which
 * recorded each pick as an update whose diff names the payee.
 */
export class AddTransactionPayeeSource1788110000000 implements MigrationInterface {
  name = 'AddTransactionPayeeSource1788110000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "payee_source" character varying(8)',
    );
    await queryRunner.query(
      `UPDATE "transactions" t
          SET "payee_source" = 'manual'
        WHERE t."payee_id" IS NOT NULL
          AND EXISTS (
            SELECT 1
              FROM "audit_events" e
             WHERE e."workspace_id" = t."workspace_id"
               AND e."entity_type" = 'transaction'
               AND e."entity_id" = t."id"
               AND e."actor_type" = 'user'
               AND e."action" = 'update'
               AND e."diff" -> 'after' ->> 'payeeId' = t."payee_id"::text
          )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "transactions" DROP COLUMN IF EXISTS "payee_source"');
  }
}
