import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Making, replacing and turning off a calendar feed link are security events
 * in the audit trail, like an API key: `calendar_feed` joins the entity types.
 */
export class AddCalendarFeedAuditEntity1788230000000 implements MigrationInterface {
  name = 'AddCalendarFeedAuditEntity1788230000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [entityType] = await queryRunner.query(`
      SELECT udt_name AS type_name FROM information_schema.columns
       WHERE table_name = 'audit_events' AND column_name = 'entity_type' AND data_type = 'USER-DEFINED'
       LIMIT 1
    `);
    if (entityType?.type_name) {
      await queryRunner.query(
        `ALTER TYPE "${entityType.type_name}" ADD VALUE IF NOT EXISTS 'calendar_feed'`,
      );
    }
  }

  public async down(): Promise<void> {
    // The value stays: Postgres cannot drop an enum value, and audit events
    // written with it must keep reading.
  }
}
