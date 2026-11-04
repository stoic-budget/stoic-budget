import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Parsers used to store a fixed-language word where the file named no
 * counterparty or purpose ("Неизвестный контрагент", "Не указано", "Unknown").
 * They now store an empty string and the app shows "Unknown payee" in the
 * reader's language, so the old words become empty too: duplicate detection
 * compares these columns, and a re-imported file must still match its rows.
 */
export class ClearParserPlaceholders1787680000000 implements MigrationInterface {
  name = 'ClearParserPlaceholders1787680000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "transactions" SET "counterparty_name" = ''
       WHERE "counterparty_name" IN ('Неизвестный контрагент', 'Не указано', 'Unknown')`,
    );
    await queryRunner.query(
      `UPDATE "transactions" SET "payment_purpose" = '' WHERE "payment_purpose" = 'Не указано'`,
    );
  }

  public async down(): Promise<void> {
    // The words were placeholders, not data: an empty name or purpose reads the same.
  }
}
