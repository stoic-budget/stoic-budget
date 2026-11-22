import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddKeybankBankName1788480000000 implements MigrationInterface {
  name = 'AddKeybankBankName1788480000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'keybank\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'keybank' value will remain but is harmless if unused.
  }
}
