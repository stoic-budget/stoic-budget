import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRaiffeisenbankCzBankName1789540000000 implements MigrationInterface {
  name = 'AddRaiffeisenbankCzBankName1789540000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'raiffeisenbank_cz\'',
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'raiffeisenbank_cz' value will remain but is harmless if unused.
  }
}
