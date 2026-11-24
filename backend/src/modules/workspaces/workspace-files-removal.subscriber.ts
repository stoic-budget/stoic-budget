import * as fs from 'node:fs/promises';
import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type {
  DataSource,
  EntitySubscriberInterface,
  QueryRunner,
  RemoveEvent,
  TransactionCommitEvent,
  TransactionRollbackEvent,
} from 'typeorm';
import { Workspace } from '../../entities/workspace.entity';
import { VersionBlobStore } from '../versions/version-blob-store';

/**
 * A deleted workspace takes its files with it (#642): the database cascade
 * removes the rows that name them, so the statement files and the stored
 * versions would stay on disk for good. The paths are read before the delete,
 * and the files go only after it commits, and only those no statement of
 * another workspace still reads (a copy of a past version shares them).
 */
@Injectable()
export class WorkspaceFilesRemovalSubscriber implements EntitySubscriberInterface<Workspace> {
  private readonly logger = new Logger(WorkspaceFilesRemovalSubscriber.name);
  private readonly paths = new WeakMap<object, string[]>();
  private readonly queued = new WeakMap<QueryRunner, Array<() => Promise<void>>>();
  private readonly versions = new VersionBlobStore();

  constructor(@InjectDataSource() dataSource: DataSource) {
    dataSource.subscribers.push(this);
  }

  listenTo() {
    return Workspace;
  }

  async beforeRemove(event: RemoveEvent<Workspace>): Promise<void> {
    const workspace = event.entity;
    if (!workspace?.id) return;
    const rows: Array<{ file_path: string }> = await event.manager.query(
      `SELECT DISTINCT "file_path" FROM "statements" WHERE "workspace_id" = $1 AND "file_path" IS NOT NULL`,
      [workspace.id],
    );
    this.paths.set(
      workspace,
      rows.map(row => row.file_path),
    );
  }

  async afterRemove(event: RemoveEvent<Workspace>): Promise<void> {
    const workspaceId = event.entityId as string | undefined;
    const paths = event.entity ? (this.paths.get(event.entity) ?? []) : [];
    if (!workspaceId) return;
    // The cascade has run: whatever still names a path belongs to another workspace.
    const kept: Array<{ file_path: string }> = paths.length
      ? await event.manager.query(
          `SELECT DISTINCT "file_path" FROM "statements" WHERE "file_path" = ANY($1::text[])`,
          [paths],
        )
      : [];
    const shared = new Set(kept.map(row => row.file_path));
    const orphaned = paths.filter(filePath => !shared.has(filePath));
    this.defer(event.queryRunner, async () => {
      for (const filePath of orphaned) {
        await fs.rm(filePath, { force: true }).catch(error => this.warn(filePath, error));
      }
      await this.versions.removeWorkspace(workspaceId).catch(error => this.warn('versions', error));
    });
  }

  afterTransactionCommit(event: TransactionCommitEvent): void {
    const tasks = this.queued.get(event.queryRunner);
    this.queued.delete(event.queryRunner);
    for (const task of tasks ?? []) {
      void task();
    }
  }

  afterTransactionRollback(event: TransactionRollbackEvent): void {
    this.queued.delete(event.queryRunner);
  }

  /** After the commit; at once when the delete ran outside a transaction. */
  private defer(runner: QueryRunner | undefined, task: () => Promise<void>): void {
    if (runner?.isTransactionActive) {
      this.queued.set(runner, [...(this.queued.get(runner) ?? []), task]);
    } else {
      void task();
    }
  }

  private warn(what: string, error: unknown): void {
    this.logger.warn(`Deleted workspace: could not remove ${what}: ${String(error)}`);
  }
}
