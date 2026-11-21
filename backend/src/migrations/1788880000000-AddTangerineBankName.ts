import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTangerineBankName1788880000000 implements MigrationInterface {
  name = 'AddTangerineBankName1788880000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'tangerine\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'tangerine' value will remain but is harmless if unused.
  }
}
