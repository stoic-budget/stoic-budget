import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddQnbBankName1788690000000 implements MigrationInterface {
  name = 'AddQnbBankName1788690000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'qnb\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'qnb' value will remain but is harmless if unused.
  }
}
