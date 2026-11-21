import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFirstDirectBankName1788280000000 implements MigrationInterface {
  name = 'AddFirstDirectBankName1788280000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'first_direct\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'first_direct' value will remain but is harmless if unused.
  }
}
