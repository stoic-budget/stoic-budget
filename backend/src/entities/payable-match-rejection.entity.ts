import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Payable } from './payable.entity';
import { Transaction } from './transaction.entity';
import { User } from './user.entity';
import { Workspace } from './workspace.entity';

/** "Not this payment": a bank row a person refused as the payment of a bill. */
@Entity('payable_match_rejections')
@Index('UQ_payable_match_rejections_pair', ['payableId', 'transactionId'], { unique: true })
@Index('IDX_payable_match_rejections_workspace', ['workspaceId'])
@Index('IDX_payable_match_rejections_transaction', ['transactionId'])
export class PayableMatchRejection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Relation<Workspace>;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @ManyToOne(() => Payable, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'payable_id' })
  payable: Relation<Payable>;

  @Column({ name: 'payable_id', type: 'uuid' })
  payableId: string;

  @ManyToOne(() => Transaction, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'transaction_id' })
  transaction: Relation<Transaction>;

  @Column({ name: 'transaction_id', type: 'uuid' })
  transactionId: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: Relation<User | null>;

  @Column({ name: 'created_by_id', type: 'uuid', nullable: true })
  createdById: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
