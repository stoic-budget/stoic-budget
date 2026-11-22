import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
  UpdateDateColumn,
} from 'typeorm';
import type {
  ClassificationResult,
  MatchMode,
  RuleConditionNode,
} from '../modules/classification/interfaces/classification-rule.interface';
import { User } from './user.entity';
import { Workspace } from './workspace.entity';

@Entity('categorization_rules')
export class CategorizationRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Relation<Workspace>;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'jsonb' })
  conditions: RuleConditionNode[];

  /** Whether a row has to pass all of the conditions or any one of them. */
  @Column({ name: 'match_mode', type: 'varchar', length: 8, default: 'all' })
  matchMode: MatchMode;

  @Column({ type: 'jsonb' })
  result: ClassificationResult;

  @Column({ default: 0 })
  priority: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'match_count', default: 0 })
  matchCount: number;

  @Column({ name: 'last_matched_at', type: 'timestamp', nullable: true })
  lastMatchedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
