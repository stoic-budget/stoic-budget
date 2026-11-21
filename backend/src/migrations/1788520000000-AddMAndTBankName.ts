import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMAndTBankName1788520000000 implements MigrationInterface {
  name = 'AddMAndTBankName1788520000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'m_and_t\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'm_and_t' value will remain but is harmless if unused.
  }
}
