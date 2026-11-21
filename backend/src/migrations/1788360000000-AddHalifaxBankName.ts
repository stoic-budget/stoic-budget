import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHalifaxBankName1788360000000 implements MigrationInterface {
  name = 'AddHalifaxBankName1788360000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'halifax\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'halifax' value will remain but is harmless if unused.
  }
}
