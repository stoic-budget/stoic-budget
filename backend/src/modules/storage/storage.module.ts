import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileStorageService } from '../../common/services/file-storage.service';
import {
  Category,
  FilePermission,
  FileVersion,
  Folder,
  SharedLink,
  Statement,
  StorageView,
  Tag,
  Transaction,
  User,
  WorkspaceMember,
} from '../../entities';
import { MetricsService } from '../observability/metrics.service';
import { ObservabilityModule } from '../observability/observability.module';
import { StatementsModule } from '../statements/statements.module';
import { TagsModule } from '../tags/tags.module';
import { StorageController } from './storage.controller';
import { StorageService } from './storage.service';
import { StorageAccessService } from './storage-access.service';
import { StorageFilesQueryService } from './storage-files-query.service';
import { StorageFoldersService } from './storage-folders.service';
import { StorageSharingController } from './storage-sharing.controller';
import { StorageTagsController } from './storage-tags.controller';
import { StorageTrashScheduler } from './storage-trash.scheduler';

/**
 * Storage module for file management, sharing, and permissions
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      SharedLink,
      FilePermission,
      FileVersion,
      Folder,
      Statement,
      Tag,
      StorageView,
      Transaction,
      Category,
      User,
      WorkspaceMember,
    ]),
    ObservabilityModule,
    StatementsModule,
    TagsModule,
  ],
  controllers: [StorageController, StorageSharingController, StorageTagsController],
  providers: [
    StorageService,
    StorageAccessService,
    StorageFilesQueryService,
    StorageFoldersService,
    StorageTrashScheduler,
    FileStorageService,
    MetricsService,
  ],
  exports: [StorageService],
})
export class StorageModule {}
