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
import { McpOAuthGrant } from './mcp-oauth-grant.entity';

export type McpOAuthTokenKind = 'access' | 'refresh';

/**
 * An access or refresh token, by its SHA-256 hash. A refresh token is used
 * once: `usedAt` marks it rotated, and presenting it again revokes the grant.
 */
@Entity('mcp_oauth_tokens')
@Index('IDX_mcp_oauth_tokens_grant', ['grantId'])
@Unique('UQ_mcp_oauth_tokens_hash', ['tokenHash'])
export class McpOAuthToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => McpOAuthGrant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'grant_id' })
  grant: Relation<McpOAuthGrant>;

  @Column({ name: 'grant_id', type: 'uuid' })
  grantId: string;

  @Column({ type: 'varchar', length: 16 })
  kind: McpOAuthTokenKind;

  @Column({ name: 'token_hash', type: 'varchar', length: 64 })
  tokenHash: string;

  /** An access token narrowed below its grant on refresh; null carries the grant's scopes. */
  @Column({ type: 'jsonb', nullable: true })
  scopes: string[] | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
