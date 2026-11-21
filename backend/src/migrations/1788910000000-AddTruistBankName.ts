import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTruistBankName1788910000000 implements MigrationInterface {
  name = 'AddTruistBankName1788910000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'truist\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'truist' value will remain but is harmless if unused.
  }
}
