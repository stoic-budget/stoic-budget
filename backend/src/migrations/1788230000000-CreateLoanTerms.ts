import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The terms of a debt account: principal, rate and its changes, term, payment
 * day, method and day count. One row per account, gone with the account.
 */
export class CreateLoanTerms1788230000000 implements MigrationInterface {
  name = 'CreateLoanTerms1788230000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS loan_terms (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        workspace_id uuid NOT NULL,
        wallet_id uuid NOT NULL,
        principal numeric(15,2) NOT NULL,
        start_date date NOT NULL,
        term_months smallint NOT NULL,
        payment_day smallint NOT NULL,
        method varchar(16) NOT NULL,
        day_count varchar(16) NOT NULL,
        annual_rate numeric(7,4) NOT NULL,
        rate_changes jsonb NOT NULL DEFAULT '[]',
        extra_payments jsonb NOT NULL DEFAULT '[]',
        recurring_extra jsonb,
        extra_mode varchar(16) NOT NULL DEFAULT 'reduce_term',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_loan_terms_workspace" FOREIGN KEY (workspace_id)
          REFERENCES "workspaces"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_loan_terms_wallet" FOREIGN KEY (wallet_id)
          REFERENCES "wallets"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_loan_terms_wallet" UNIQUE (wallet_id),
        CONSTRAINT "CHK_loan_terms_principal" CHECK (principal > 0),
        CONSTRAINT "CHK_loan_terms_term" CHECK (term_months BETWEEN 1 AND 600),
        CONSTRAINT "CHK_loan_terms_payment_day" CHECK (payment_day BETWEEN 1 AND 31),
        CONSTRAINT "CHK_loan_terms_rate" CHECK (annual_rate >= 0 AND annual_rate <= 100),
        CONSTRAINT "CHK_loan_terms_method" CHECK (method IN ('annuity', 'linear', 'interest_only')),
        CONSTRAINT "CHK_loan_terms_day_count" CHECK (day_count IN ('30/360', 'actual/365')),
        CONSTRAINT "CHK_loan_terms_extra_mode" CHECK (extra_mode IN ('reduce_term', 'reduce_payment'))
      )
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_loan_terms_workspace" ON loan_terms (workspace_id)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS loan_terms');
  }
}
