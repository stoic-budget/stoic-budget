import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBnpParibasBankName1787710000000 implements MigrationInterface {
  name = 'AddBnpParibasBankName1787710000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TYPE "bank_name_enum" ADD VALUE IF NOT EXISTS \'bnp_paribas\'');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // The 'bnp_paribas' value will remain but is harmless if unused.
  }
}
