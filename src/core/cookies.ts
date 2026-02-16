import type { Request } from 'express';
import { COOKIE_NAME, ONE_YEAR_MS } from '../../shared/const';

export function getSessionCookieOptions(req: Request) {
  const isSecure = req.protocol === 'https';
  return {
    httpOnly: true,
    secure: isSecure,
    path: '/',
    sameSite: isSecure ? ('none' as const) : ('lax' as const),
    maxAge: ONE_YEAR_MS,
  };
}

export function getSessionCookie(req: Request) {
  return req.cookies?.[COOKIE_NAME];
}

