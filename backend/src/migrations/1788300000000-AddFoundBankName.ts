import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFoundBankName1788300000000 implements MigrationInterface {
  name = 'AddFoundBankName1788300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'found\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'found' value will remain but is harmless if unused.
  }
}
