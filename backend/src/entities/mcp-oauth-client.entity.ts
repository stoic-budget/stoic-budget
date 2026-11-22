import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * An MCP client that registered itself (RFC 7591). Public clients only: there
 * is no secret, so the id is not a credential. Nobody owns a client; what it
 * may reach is decided per grant, by the person who approves it.
 */
@Entity('mcp_oauth_clients')
export class McpOAuthClient {
  /** The `client_id` the client sends. */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'client_name', type: 'varchar', length: 200 })
  clientName: string;

  /** Exactly as registered; an authorization request must name one of them verbatim. */
  @Column({ name: 'redirect_uris', type: 'jsonb' })
  redirectUris: string[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
