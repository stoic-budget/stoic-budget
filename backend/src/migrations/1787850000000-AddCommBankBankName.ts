import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCommBankBankName1787850000000 implements MigrationInterface {
  name = 'AddCommBankBankName1787850000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'commbank\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'commbank' value will remain but is harmless if unused.
  }
}
