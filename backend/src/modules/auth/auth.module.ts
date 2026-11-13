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
  PasswordResetToken,
  User,
  UserIdentity,
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
import { OidcController } from './oidc/oidc.controller';
import { OidcAccountsService } from './oidc/oidc-accounts.service';
import { OidcIdentitiesService } from './oidc/oidc-identities.service';
import { OidcLoginService } from './oidc/oidc-login.service';
import { OidcProviderClient } from './oidc/oidc-provider.client';
import { OidcSettingsController } from './oidc/oidc-settings.controller';
import { OidcSettingsService } from './oidc/oidc-settings.service';
import { OidcStateStore } from './oidc/oidc-state.store';
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
      UserIdentity,
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
  controllers: [AuthController, RegistrationController, OidcController, OidcSettingsController],
  providers: [
    AuthService,
    RegistrationSettingsService,
    TwoFactorService,
    PasswordResetService,
    AuthDevBootstrapService,
    JwtStrategy,
    JwtRefreshStrategy,
    OidcStateStore,
    OidcProviderClient,
    OidcSettingsService,
    OidcAccountsService,
    OidcIdentitiesService,
    OidcLoginService,
  ],
  exports: [AuthService],
})
export class AuthModule {}
