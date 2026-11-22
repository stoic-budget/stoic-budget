import { Controller, Get, Put } from '@nestjs/common';
import { WorkspaceId } from '../../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../../common/effect/schema-body';
import { SchemaParams } from '../../../common/effect/schema-query';
import { SchemaResponse } from '../../../common/effect/schema-response';
import { Permission } from '../../../common/enums/permissions.enum';
import {
  BalanceAccountParams,
  PropertyDebtOptions,
  PropertyDetails,
  UpdatePropertyBody,
} from '../../../contracts';
import type { User } from '../../../entities/user.entity';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { BalancePropertyService } from './balance-property.service';

/** The details of the real estate and vehicle lines; writing them takes the wallet permissions, like the sheet. */
@Controller('reports/balance')
export class BalancePropertyController {
  constructor(private readonly propertyService: BalancePropertyService) {}

  @Get('property-debts')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  @SchemaResponse(PropertyDebtOptions)
  async debtOptions(@CurrentUser() user: User, @WorkspaceId() workspaceId: string) {
    return this.propertyService.debtOptions(workspaceId, user.locale);
  }

  @Put('accounts/:id/property')
  @WorkspaceAuth(Permission.WALLET_EDIT)
  @SchemaResponse(PropertyDetails)
  async update(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaParams(BalanceAccountParams) { id }: BalanceAccountParams,
    @SchemaBody(UpdatePropertyBody) body: UpdatePropertyBody,
  ) {
    return this.propertyService.update(user.id, workspaceId, id, body);
  }
}
