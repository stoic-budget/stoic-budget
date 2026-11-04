import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCapitecBankName1787750000000 implements MigrationInterface {
  name = 'AddCapitecBankName1787750000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'capitec\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'capitec' value will remain but is harmless if unused.
  }
}
