import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddZenithBankName1789070000000 implements MigrationInterface {
  name = 'AddZenithBankName1789070000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'zenith\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'zenith' value will remain but is harmless if unused.
  }
}
