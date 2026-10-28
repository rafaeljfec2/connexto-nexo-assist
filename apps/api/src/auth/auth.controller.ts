import { Body, Controller, Get, Inject, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { LoginRequestSchema } from '@nexo-assist/contracts';
import { AuthService } from './auth.service';
import { AuthGuard, type AuthedRequest, readSessionCookie } from './auth.guard';

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  /** Demo auth accepts any non-empty password — keep brute-force cheap to burn. */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  async login(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const parsed = LoginRequestSchema.parse(body);
    const result = await this.auth.login(
      parsed.email,
      parsed.password,
      parsed.rememberMe ?? false,
    );
    const secure = process.env.NODE_ENV === 'production';
    res.cookie('nexo_session', result.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      expires: result.expiresAt,
      path: '/',
    });
    return { user: result.user };
  }

  @Post('logout')
  async logout(@Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(readSessionCookie(req));
    const secure = process.env.NODE_ENV === 'production';
    res.clearCookie('nexo_session', { path: '/', secure, sameSite: 'lax' });
    return { ok: true };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@Req() req: AuthedRequest) {
    return { user: req.user };
  }
}
