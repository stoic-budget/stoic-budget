import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSchwabBankName1787770000000 implements MigrationInterface {
  name = 'AddSchwabBankName1787770000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'schwab\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'schwab' value will remain but is harmless if unused.
  }
}
