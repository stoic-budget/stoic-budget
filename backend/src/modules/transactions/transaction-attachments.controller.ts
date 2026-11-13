import * as fs from 'node:fs';
import { Controller, Delete, Get, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { WorkspaceId, WorkspaceMemberId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaParams } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import { deletedResponse } from '../../common/utils/responses.util';
import { pipeFileStreamResponse } from '../../common/utils/stream-response.util';
import { multerConfig } from '../../config/multer.config';
import {
  MessageResult,
  TransactionAttachment,
  TransactionAttachmentList,
  TransactionAttachmentParams,
  TransactionParams,
} from '../../contracts';
import { EntityType } from '../../entities/audit-event.entity';
import type { User } from '../../entities/user.entity';
import { Audit } from '../audit/decorators/audit.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TransactionAttachmentsService } from './services/transaction-attachments.service';

/**
 * Aliased on purpose: writing `Express.Multer.File` straight into a decorated
 * parameter makes emitDecoratorMetadata emit a runtime reference to `Express`,
 * which does not exist and throws at import time.
 */
type MulterFile = Express.Multer.File;

/** Files pinned to a row: a receipt photo, an invoice PDF. Reading needs view, changing needs edit. */
@Controller('transactions')
export class TransactionAttachmentsController {
  constructor(private readonly attachments: TransactionAttachmentsService) {}

  @Get(':id/attachments')
  @WorkspaceAuth(Permission.TRANSACTION_VIEW)
  @SchemaResponse(TransactionAttachmentList)
  async list(
    @SchemaParams(TransactionParams) { id }: TransactionParams,
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() viewerMemberId: string | null,
  ) {
    return this.attachments.list(id, { workspaceId, viewerMemberId });
  }

  // Disk storage, like every other upload: validateFile then reads the first
  // bytes, and the file is checked before it is moved in.
  @Post(':id/attachments')
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  @UseInterceptors(FileInterceptor('file', multerConfig))
  @Audit({ entityType: EntityType.TRANSACTION })
  @SchemaResponse(TransactionAttachment)
  async upload(
    @SchemaParams(TransactionParams) { id }: TransactionParams,
    @UploadedFile() file: MulterFile,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() viewerMemberId: string | null,
  ) {
    return this.attachments.create(id, { workspaceId, viewerMemberId, userId: user.id }, file);
  }

  /**
   * Always a download (Content-Disposition: attachment) of a photo, a PDF or
   * plain bytes, never sniffed: a file cannot run as a page on the app's origin.
   */
  @Get('attachments/:attachmentId/download')
  @WorkspaceAuth(Permission.TRANSACTION_VIEW)
  async download(
    @SchemaParams(TransactionAttachmentParams) { attachmentId }: TransactionAttachmentParams,
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() viewerMemberId: string | null,
    @Res() res: Response,
  ) {
    const { absolutePath, fileName, mimeType } = await this.attachments.getForDownload(
      attachmentId,
      { workspaceId, viewerMemberId },
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.setHeader('Cache-Control', 'private, no-store');
    pipeFileStreamResponse(res, fs.createReadStream(absolutePath), {
      disposition: 'attachment',
      fileName,
      mimeType,
      errorMessage: 'Could not read the attachment',
    });
  }

  @Delete('attachments/:attachmentId')
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  @Audit({ entityType: EntityType.TRANSACTION })
  @SchemaResponse(MessageResult)
  async remove(
    @SchemaParams(TransactionAttachmentParams) { attachmentId }: TransactionAttachmentParams,
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() viewerMemberId: string | null,
  ) {
    await this.attachments.remove(attachmentId, { workspaceId, viewerMemberId });
    return deletedResponse('Attachment');
  }
}
