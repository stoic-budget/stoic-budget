import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { appError } from '../../../common/errors/app-error';
import { User } from '../../../entities';

/**
 * `REGISTRATION_ENABLED=false` closes sign-up on an instance open to the
 * internet. An invitation still gets through, the service checks that it is
 * real, and so does the first account, or a new instance could never get an owner.
 */
@Injectable()
export class RegistrationOpenGuard implements CanActivate {
  constructor(@InjectRepository(User) private readonly userRepository: Repository<User>) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (process.env.REGISTRATION_ENABLED !== 'false') return true;
    const request = context.switchToHttp().getRequest<{ body?: { invitationToken?: unknown } }>();
    const token = request.body?.invitationToken;
    if (typeof token === 'string' && token.trim()) return true;
    if ((await this.userRepository.count()) === 0) return true;
    throw new ForbiddenException(appError('AUTH_REGISTRATION_CLOSED'));
  }
}
