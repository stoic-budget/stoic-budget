import {
  Controller,
  Delete,
  Post,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiKeyAllowed } from '../../common/decorators/api-key-allowed.decorator';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import type { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';
import {
  AppImportForm,
  AppImportResult,
  EntityImportBatchParams,
  EntityImportResult,
  EntityImportUndone,
  ImportSuggestion,
  RunEntityImportBody,
  SuggestImportBody,
} from '../../contracts';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AppImportService } from './apps/app-import.service';
import { EntityImportService } from './entity-import.service';
import { ImportSuggestService } from './import-suggest.service';

/** A YNAB plan and register, say: a handful of files is plenty. */
const APP_FILES_MAX = 6;

/** Spreadsheet rows → payables, subscriptions, invoices, budgets or a statement. */
@Controller('entity-imports')
@UseGuards(JwtAuthGuard, WorkspaceContextGuard)
export class EntityImportsController {
  constructor(
    private readonly entityImport: EntityImportService,
    private readonly suggest: ImportSuggestService,
    private readonly appImport: AppImportService,
  ) {}

  @Post('suggest')
  @SchemaResponse(ImportSuggestion)
  suggestTarget(@SchemaBody(SuggestImportBody) dto: SuggestImportBody) {
    return this.suggest.suggest(dto);
  }

  @Post()
  // Scoped keys are let through: the service checks the scope the target needs.
  @ApiKeyAllowed()
  @SchemaResponse(EntityImportResult)
  run(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(RunEntityImportBody) dto: RunEntityImportBody,
    @Req() req: AuthenticatedRequest,
  ) {
    // Which scope a key needs depends on the target, so the service checks it.
    return this.entityImport.run(user.id, workspaceId, dto, req.apiKey);
  }

  /** Exports of another budgeting app: a dry run, or the import as one batch. */
  @Post('apps')
  @ApiKeyAllowed()
  @UseInterceptors(
    FilesInterceptor('files', APP_FILES_MAX, {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024, files: APP_FILES_MAX },
    }),
  )
  @SchemaResponse(AppImportResult)
  runApps(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    // `unknown`, not `Express.Multer.File[]`: decorator metadata cannot name a type-only namespace.
    @UploadedFiles() files: unknown,
    @SchemaBody(AppImportForm) form: AppImportForm,
    @Req() req: AuthenticatedRequest,
  ) {
    const uploads = (Array.isArray(files) ? files : []).map(
      (file: { originalname?: string; buffer?: Buffer }) => ({
        fileName: String(file.originalname ?? 'export.csv').slice(0, 255),
        buffer: new Uint8Array(file.buffer ?? Buffer.alloc(0)),
      }),
    );
    return this.appImport.run(user.id, workspaceId, uploads, form, req.apiKey);
  }

  @Delete(':batchId')
  @ApiKeyAllowed()
  @SchemaResponse(EntityImportUndone)
  undo(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaParams(EntityImportBatchParams) { batchId }: EntityImportBatchParams,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.entityImport.undo(user.id, workspaceId, batchId, req.apiKey);
  }
}
