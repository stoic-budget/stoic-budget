import { Controller, Delete, Get, Put, UseGuards } from '@nestjs/common';
import { SchemaBody } from '../../../common/effect/schema-body';
import { SchemaResponse } from '../../../common/effect/schema-response';
import { InstanceAdminGuard } from '../../../common/guards/instance-admin.guard';
import { OidcSettingsStatus, SaveOidcSettingsBody } from '../../../contracts';
import type { User } from '../../../entities';
import { CurrentUser } from '../decorators/current-user.decorator';
import { OidcSettingsService } from './oidc-settings.service';

/** The server's OpenID Connect provider: instance administrators only. */
@Controller('settings/instance/oidc')
@UseGuards(InstanceAdminGuard)
export class OidcSettingsController {
  constructor(private readonly settings: OidcSettingsService) {}

  @Get()
  @SchemaResponse(OidcSettingsStatus)
  get() {
    return this.settings.status();
  }

  @Put()
  @SchemaResponse(OidcSettingsStatus)
  save(@CurrentUser() user: User, @SchemaBody(SaveOidcSettingsBody) body: SaveOidcSettingsBody) {
    return this.settings.save(user, body);
  }

  @Delete()
  @SchemaResponse(OidcSettingsStatus)
  clear(@CurrentUser() user: User) {
    return this.settings.clear(user);
  }
}
