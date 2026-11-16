import { Body, Controller, Delete, Get, HttpCode, Patch, Post } from '@nestjs/common';
import { IsBoolean, IsEmail, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import type { Requester, UserRequester } from '../../../shared/application/requester.js';
import { Access, CurrentRequester, CurrentUser } from '../../../shared/presentation/decorators.js';
import { AuthService } from '../application/auth.service.js';

class RequestCodeBody {
  @IsEmail({}, { message: 'Địa chỉ email không hợp lệ.' }) @MaxLength(254) email: string;
}

class VerifyCodeBody {
  @IsEmail({}, { message: 'Địa chỉ email không hợp lệ.' }) @MaxLength(254) email: string;
  @IsString() @Length(6, 6, { message: 'Mã gồm 6 chữ số.' }) code: string;
  @IsOptional() @IsString() @MaxLength(80) name?: string;
  @IsOptional() @IsString() @MaxLength(16) referralCode?: string;
  @IsOptional() @IsBoolean() marketingConsent?: boolean;
}

class UpdateProfileBody {
  @IsOptional() @IsString() @MaxLength(80) name?: string;
  @IsOptional() @IsBoolean() marketingConsent?: boolean;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('code') @HttpCode(204) @Access('guest')
  async requestCode(@CurrentRequester() requester: Requester, @Body() body: RequestCodeBody) {
    await this.auth.requestCode(body.email, requester.ipHash);
  }

  @Post('verify') @HttpCode(200) @Access('guest')
  verify(@CurrentRequester() requester: Requester, @Body() body: VerifyCodeBody) {
    return this.auth.verifyCode(body, requester.visitorId, requester.ipHash);
  }

  @Get('me') @Access('user')
  me(@CurrentUser() user: UserRequester) {
    return this.auth.me(user);
  }

  @Patch('me') @Access('user')
  update(@CurrentUser() user: UserRequester, @Body() body: UpdateProfileBody) {
    return this.auth.updateProfile(user, body);
  }

  @Delete('me') @HttpCode(204) @Access('user')
  async remove(@CurrentUser() user: UserRequester) {
    await this.auth.deleteAccount(user);
  }
}
