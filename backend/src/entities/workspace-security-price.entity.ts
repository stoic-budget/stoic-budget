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
import { Workspace } from './workspace.entity';

export enum WorkspaceSecurityPriceSource {
  MANUAL = 'manual',
  IMPORT = 'import',
}

/**
 * A close a workspace typed in or imported for one of its symbols. It wins
 * over the feed's close of that day, in this workspace only: `security_prices`
 * stays the feed's shared record that no workspace can rewrite.
 */
@Entity('workspace_security_prices')
@Index('UQ_workspace_security_prices_symbol_date', ['workspaceId', 'symbol', 'priceDate'], {
  unique: true,
})
export class WorkspaceSecurityPrice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Relation<Workspace>;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @Column({ type: 'varchar', length: 32 })
  symbol: string;

  @Column({ name: 'price_date', type: 'date' })
  priceDate: string;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  close: string;

  @Column({ type: 'varchar', length: 10 })
  currency: string;

  @Column({ type: 'varchar', length: 10 })
  source: WorkspaceSecurityPriceSource;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
