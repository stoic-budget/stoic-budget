import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMerrickBankName1788540000000 implements MigrationInterface {
  name = 'AddMerrickBankName1788540000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'merrick\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'merrick' value will remain but is harmless if unused.
  }
}
