import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
  Unique,
} from 'typeorm';
import { Transaction } from './transaction.entity';
import { Workspace } from './workspace.entity';

/**
 * Two rows the user said are not one transfer (they unlinked the pair).
 * Automatic pairing never puts these two together again, while each row may
 * still pair with its real counterpart. Written once per pair, lower id first;
 * a restore gives the rows new ids and may flip that order, so readers accept
 * either.
 */
@Entity('transfer_pair_rejections')
@Unique('UQ_transfer_pair_rejections_pair', ['txLowId', 'txHighId'])
@Index('IDX_transfer_pair_rejections_workspace', ['workspaceId'])
@Index('IDX_transfer_pair_rejections_high', ['txHighId'])
export class TransferPairRejection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Relation<Workspace>;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @ManyToOne(() => Transaction, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tx_low_id' })
  txLow: Relation<Transaction>;

  @Column({ name: 'tx_low_id', type: 'uuid' })
  txLowId: string;

  @ManyToOne(() => Transaction, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tx_high_id' })
  txHigh: Relation<Transaction>;

  @Column({ name: 'tx_high_id', type: 'uuid' })
  txHighId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
