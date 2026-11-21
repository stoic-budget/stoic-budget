import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLaurentianBankName1788500000000 implements MigrationInterface {
  name = 'AddLaurentianBankName1788500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'laurentian\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'laurentian' value will remain but is harmless if unused.
  }
}
