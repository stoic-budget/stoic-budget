import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMonzoBankName1788560000000 implements MigrationInterface {
  name = 'AddMonzoBankName1788560000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'monzo\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'monzo' value will remain but is harmless if unused.
  }
}
