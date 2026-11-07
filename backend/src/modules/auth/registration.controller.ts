import { Controller, Get, Put, UseGuards } from '@nestjs/common';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaResponse } from '../../common/effect/schema-response';
import { InstanceAdminGuard } from '../../common/guards/instance-admin.guard';
import { RegistrationStatus, SaveRegistrationBody } from '../../contracts';
import type { User } from '../../entities';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { RegistrationSettingsService } from './registration-settings.service';

@Controller()
export class RegistrationController {
  constructor(private readonly registrationSettings: RegistrationSettingsService) {}

  /** Public: the sign-up page has to know before anyone fills it in. */
  @Public()
  @Get('auth/registration')
  @SchemaResponse(RegistrationStatus)
  async status() {
    return { open: await this.registrationSettings.isOpen() };
  }

  @Put('settings/instance/registration')
  @UseGuards(InstanceAdminGuard)
  @SchemaResponse(RegistrationStatus)
  async save(
    @CurrentUser() user: User,
    @SchemaBody(SaveRegistrationBody) body: SaveRegistrationBody,
  ) {
    await this.registrationSettings.setOpen(user, body.open);
    return { open: await this.registrationSettings.isOpen() };
  }
}
