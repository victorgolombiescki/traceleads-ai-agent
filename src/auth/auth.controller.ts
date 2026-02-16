import { Controller, Get, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { COOKIE_NAME } from '../../shared/const';
import { getSessionCookieOptions } from '../core/cookies';

@Controller('auth')
export class AuthController {
  constructor() {}

  @Get('me')
  async getMe(@Req() req: Request) {
    return {
      id: 1,
      openId: 'test-user',
      name: 'Test User',
      email: 'test@example.com',
      role: 'admin',
    };
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res() res: Response) {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return res.json({ success: true });
  }
}

