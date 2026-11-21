import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUsaaBankName1788970000000 implements MigrationInterface {
  name = 'AddUsaaBankName1788970000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'usaa\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'usaa' value will remain but is harmless if unused.
  }
}
