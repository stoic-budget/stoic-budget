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
import { McpOAuthClient } from './mcp-oauth-client.entity';
import { McpOAuthGrant } from './mcp-oauth-grant.entity';
import { User } from './user.entity';
import { Workspace } from './workspace.entity';
import { WorkspaceMember, type WorkspaceRole } from './workspace-member.entity';

/**
 * An authorization code from the consent screen: one use, one minute, bound
 * to the client, its redirect URI and its PKCE challenge. Only the hash is kept.
 */
@Entity('mcp_oauth_codes')
@Unique('UQ_mcp_oauth_codes_hash', ['codeHash'])
@Index('IDX_mcp_oauth_codes_expires', ['expiresAt'])
export class McpOAuthCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'code_hash', type: 'varchar', length: 64 })
  codeHash: string;

  @ManyToOne(() => McpOAuthClient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id' })
  client: Relation<McpOAuthClient>;

  @Column({ name: 'client_id', type: 'uuid' })
  clientId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Relation<Workspace>;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @ManyToOne(() => WorkspaceMember, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_member_id' })
  workspaceMember: Relation<WorkspaceMember>;

  @Column({ name: 'workspace_member_id', type: 'uuid' })
  workspaceMemberId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'granted_role', type: 'varchar', length: 16 })
  grantedRole: WorkspaceRole;

  @Column({ type: 'jsonb' })
  scopes: string[];

  @Column({ name: 'redirect_uri', type: 'text' })
  redirectUri: string;

  /** base64url(SHA-256(code_verifier)): only S256 is accepted. */
  @Column({ name: 'code_challenge', type: 'varchar', length: 64 })
  codeChallenge: string;

  @Column({ type: 'text' })
  resource: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  /** The grant the code was exchanged for: a second exchange revokes it. */
  @ManyToOne(() => McpOAuthGrant, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'grant_id' })
  grant: Relation<McpOAuthGrant | null>;

  @Column({ name: 'grant_id', type: 'uuid', nullable: true })
  grantId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
