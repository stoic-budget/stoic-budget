import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Wallet } from './wallet.entity';
import { Workspace } from './workspace.entity';

export const LOAN_METHODS = ['annuity', 'linear', 'interest_only'] as const;
export type LoanMethodValue = (typeof LOAN_METHODS)[number];

export const LOAN_DAY_COUNTS = ['30/360', 'actual/365'] as const;
export type LoanDayCountValue = (typeof LOAN_DAY_COUNTS)[number];

export const LOAN_EXTRA_MODES = ['reduce_term', 'reduce_payment'] as const;
export type LoanExtraModeValue = (typeof LOAN_EXTRA_MODES)[number];

export interface LoanRateChange {
  from: string;
  annualRate: number;
}

export interface LoanExtraPayment {
  date: string;
  amount: number;
}

export interface LoanRecurringExtra {
  amount: number;
  from: string;
}

/**
 * The terms of a debt account (a loan, or a credit card paid off in
 * instalments): one row per account, in the account's currency. The schedule
 * is worked out from these on every read and never stored.
 */
@Entity('loan_terms')
@Unique('UQ_loan_terms_wallet', ['walletId'])
export class LoanTerms {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Relation<Workspace>;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @ManyToOne(() => Wallet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'wallet_id' })
  wallet: Relation<Wallet>;

  @Column({ name: 'wallet_id', type: 'uuid' })
  walletId: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  principal: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'term_months', type: 'smallint' })
  termMonths: number;

  /** 1–31; a month without that day pays on its last day. */
  @Column({ name: 'payment_day', type: 'smallint' })
  paymentDay: number;

  @Column({ type: 'varchar', length: 16 })
  method: LoanMethodValue;

  @Column({ name: 'day_count', type: 'varchar', length: 16 })
  dayCount: LoanDayCountValue;

  /** Percent a year, as the bank states it. */
  @Column({ name: 'annual_rate', type: 'decimal', precision: 7, scale: 4 })
  annualRate: string;

  @Column({ name: 'rate_changes', type: 'jsonb', default: () => "'[]'" })
  rateChanges: LoanRateChange[];

  @Column({ name: 'extra_payments', type: 'jsonb', default: () => "'[]'" })
  extraPayments: LoanExtraPayment[];

  @Column({ name: 'recurring_extra', type: 'jsonb', nullable: true })
  recurringExtra: LoanRecurringExtra | null;

  @Column({ name: 'extra_mode', type: 'varchar', length: 16, default: 'reduce_term' })
  extraMode: LoanExtraModeValue;

  /** Split new payments into the account into principal and interest on import. */
  @Column({ name: 'auto_split', type: 'boolean', default: false })
  autoSplit: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
