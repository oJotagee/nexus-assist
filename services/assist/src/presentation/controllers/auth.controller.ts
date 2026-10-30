import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { UserDto } from '@nexo/shared';

import { RequestPasswordResetUseCase } from '@/application/use-cases/auth/request-password-reset.use-case';
import { GetProfileUseCase } from '@/application/use-cases/auth/get-profile.use-case';
import { LoginUseCase } from '@/application/use-cases/auth/login.use-case';
import { type AuthUser, JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { RATE_LIMITS } from '@/infrastructure/config/rate-limit';
import { LoginRequestDto } from '../dtos/requests.dto';

@ApiTags('auth')
@Controller()
export class AuthController {
  constructor(
    private readonly login: LoginUseCase,
    private readonly getProfile: GetProfileUseCase,
    private readonly requestPasswordReset: RequestPasswordResetUseCase,
  ) {}

  @Post('auth/login')
  @HttpCode(200)
  @Throttle({ default: RATE_LIMITS.login })
  signIn(@Body() body: LoginRequestDto): Promise<{ accessToken: string; user: UserDto }> {
    return this.login.execute(body);
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser): Promise<UserDto> {
    return this.getProfile.execute(user.id);
  }

  @Post('me/password-reset')
  @HttpCode(200)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  passwordReset(@CurrentUser() user: AuthUser): Promise<{ sentTo: string }> {
    return this.requestPasswordReset.execute(user.id);
  }
}
