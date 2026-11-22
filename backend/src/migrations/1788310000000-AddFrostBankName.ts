import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFrostBankName1788310000000 implements MigrationInterface {
  name = 'AddFrostBankName1788310000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'frost\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'frost' value will remain but is harmless if unused.
  }
}
