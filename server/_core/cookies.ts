import type { Request } from 'express';

export function getSessionCookieOptions(req: Request) {
  const isSecure = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https';
  
  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax' as const,
    path: '/',
  };
}

