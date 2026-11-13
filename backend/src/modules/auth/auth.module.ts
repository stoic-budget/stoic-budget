import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, type JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { StringValue } from 'ms';
import { devDefault } from '../../common/utils/dev-defaults';
import {
  AuthSession,
  InstanceSetting,
  PasskeyCredential,
  PasswordResetToken,
  User,
  Workspace,
  WorkspaceInvitation,
  WorkspaceMember,
} from '../../entities';
import { AuditModule } from '../audit/audit.module';
import { CategoriesModule } from '../categories/categories.module';
import { MailerModule } from '../mailer/mailer.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthDevBootstrapService } from './auth-dev-bootstrap.service';
import { PasskeyAuthService } from './passkeys/passkey-auth.service';
import { PasskeyChallengeStore } from './passkeys/passkey-challenge.store';
import { PasskeysController } from './passkeys/passkeys.controller';
import { PasskeysService } from './passkeys/passkeys.service';
import { PasswordResetService } from './password-reset.service';
import { RegistrationController } from './registration.controller';
import { RegistrationSettingsService } from './registration-settings.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { TwoFactorService } from './two-factor.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      InstanceSetting,
      Workspace,
      WorkspaceInvitation,
      WorkspaceMember,
      AuthSession,
      PasswordResetToken,
      PasskeyCredential,
    ]),
    AuditModule,
    CategoriesModule,
    MailerModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService): JwtModuleOptions => {
        const secret = devDefault(configService.get<string>('JWT_SECRET'), 'JWT_SECRET');
        return {
          secret,
          signOptions: {
            expiresIn: (configService.get<string>('JWT_EXPIRES_IN') || '30m') as StringValue,
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController, RegistrationController, PasskeysController],
  providers: [
    AuthService,
    RegistrationSettingsService,
    TwoFactorService,
    PasskeysService,
    PasskeyAuthService,
    PasskeyChallengeStore,
    PasswordResetService,
    AuthDevBootstrapService,
    JwtStrategy,
    JwtRefreshStrategy,
  ],
  exports: [AuthService],
})
export class AuthModule {}
