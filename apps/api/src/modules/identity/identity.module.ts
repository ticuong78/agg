import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './application/auth.service.js';
import { Authenticator } from './application/authenticator.js';
import { IdentityFacade } from './application/identity.facade.js';
import { AdminDirectory, CodeHasher, TokenService } from './application/ports.js';
import { SignInCodeRepository, UserRepository } from './domain/repositories.js';
import { SignInCodeOrmEntity, UserOrmEntity } from './infrastructure/orm-entities.js';
import { EnvAdminDirectory, HmacCodeHasher, JwtTokenService } from './infrastructure/security.js';
import { TypeOrmSignInCodeRepository, TypeOrmUserRepository } from './infrastructure/typeorm-repositories.js';
import { AuthController } from './presentation/auth.controller.js';
import { RequestGuard } from './presentation/request.guard.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserOrmEntity, SignInCodeOrmEntity]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '30d' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    Authenticator,
    IdentityFacade,
    { provide: UserRepository, useClass: TypeOrmUserRepository },
    { provide: SignInCodeRepository, useClass: TypeOrmSignInCodeRepository },
    { provide: CodeHasher, useClass: HmacCodeHasher },
    { provide: TokenService, useClass: JwtTokenService },
    { provide: AdminDirectory, useClass: EnvAdminDirectory },
    { provide: APP_GUARD, useClass: RequestGuard },
  ],
  exports: [IdentityFacade],
})
export class IdentityModule {}
