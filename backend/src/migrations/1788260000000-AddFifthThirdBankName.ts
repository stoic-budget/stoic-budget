import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFifthThirdBankName1788260000000 implements MigrationInterface {
  name = 'AddFifthThirdBankName1788260000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'fifth_third\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'fifth_third' value will remain but is harmless if unused.
  }
}
