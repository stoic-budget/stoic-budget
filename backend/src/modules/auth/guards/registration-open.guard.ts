import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { appError } from '../../../common/errors/app-error';
import { RegistrationSettingsService } from '../registration-settings.service';

/** When sign-up is closed, only an invitation gets through; the service checks that it is real. */
@Injectable()
export class RegistrationOpenGuard implements CanActivate {
  constructor(private readonly registrationSettings: RegistrationSettingsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ body?: { invitationToken?: unknown } }>();
    const token = request.body?.invitationToken;
    if (typeof token === 'string' && token.trim()) return true;
    if (await this.registrationSettings.isOpen()) return true;
    throw new ForbiddenException(appError('AUTH_REGISTRATION_CLOSED'));
  }
}
