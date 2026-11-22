import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
  UpdateDateColumn,
} from 'typeorm';
import { InvestmentHolding } from './investment-holding.entity';
import { Transaction } from './transaction.entity';
import { Workspace } from './workspace.entity';

export enum InvestmentTradeKind {
  BUY = 'buy',
  SELL = 'sell',
  DIVIDEND = 'dividend',
  SPLIT = 'split',
  TRANSFER_IN = 'transfer_in',
  TRANSFER_OUT = 'transfer_out',
}

/**
 * One event in a holding's life. A holding with trades takes its quantity from
 * them (`trade-ledger.ts` replays them into lots); a holding without any keeps
 * the quantity typed into it, as before trades existed. The CHECK constraints
 * in the migration say which fields each kind uses.
 */
@Entity('investment_trades')
@Index('IDX_investment_trades_workspace_holding_date', ['workspaceId', 'holdingId', 'tradeDate'])
export class InvestmentTrade {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Relation<Workspace>;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @ManyToOne(() => InvestmentHolding, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'holding_id' })
  holding: Relation<InvestmentHolding>;

  @Column({ name: 'holding_id', type: 'uuid' })
  holdingId: string;

  @Column({
    type: 'enum',
    enum: InvestmentTradeKind,
    enumName: 'investment_trade_kind_enum',
  })
  kind: InvestmentTradeKind;

  @Column({ name: 'trade_date', type: 'date' })
  tradeDate: string;

  /** Units bought, sold or moved; 0 for a dividend or a split. */
  @Column({ type: 'decimal', precision: 24, scale: 8, default: 0 })
  quantity: number;

  /** Per unit; for a transfer in, the cost each unit carries. */
  @Column({ type: 'decimal', precision: 20, scale: 8, default: 0 })
  price: number;

  /** Commission, or the tax held back from a dividend. */
  @Column({ type: 'decimal', precision: 20, scale: 6, default: 0 })
  fee: number;

  /** Dividend only: the cash it paid, before `fee`. */
  @Column({ type: 'decimal', precision: 20, scale: 6, nullable: true })
  amount: number | null;

  @Column({ length: 10 })
  currency: string;

  /** Split only: `splitTo` new units for every `splitFrom` old ones (3:1 → 3 and 1). */
  @Column({ name: 'split_from', type: 'decimal', precision: 20, scale: 8, nullable: true })
  splitFrom: number | null;

  @Column({ name: 'split_to', type: 'decimal', precision: 20, scale: 8, nullable: true })
  splitTo: number | null;

  /** Transfer in only: when the units were first bought elsewhere. */
  @Column({ name: 'acquired_on', type: 'date', nullable: true })
  acquiredOn: string | null;

  /** The cash leg, when the user linked it; goes NULL if that row is deleted. */
  @ManyToOne(() => Transaction, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'transaction_id' })
  transaction: Relation<Transaction | null>;

  @Column({ name: 'transaction_id', type: 'uuid', nullable: true })
  transactionId: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
