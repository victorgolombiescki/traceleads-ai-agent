import type { Request } from 'express';
import type { User } from '../entities/user.entity';
// Using process.env directly
import { getSessionCookie } from './cookies';
import { COOKIE_NAME, AXIOS_TIMEOUT_MS } from '../../shared/const';
import { ForbiddenError } from '../../shared/_core/errors';
import axios from 'axios';

export const sdk = {
  async authenticateRequest(req: Request): Promise<User | null> {
    const sessionId = getSessionCookie(req);
    if (!sessionId) {
      return null;
    }

    try {
      const response = await axios.post(
        `${process.env.OAUTH_SERVER_URL || ''}/api/v1/auth/me`,
        {},
        {
          headers: {
            Cookie: `${COOKIE_NAME}=${sessionId}`,
          },
          timeout: AXIOS_TIMEOUT_MS,
        }
      );

      const user = response.data as User;
      if (!user) {
        return null;
      }

      // Basic role check, can be expanded
      if (user.role === 'admin' && user.openId !== process.env.OWNER_OPEN_ID) {
        throw ForbiddenError("User is admin but not owner");
      }

      return user;
    } catch (error) {
      console.error("Authentication failed:", error);
      return null;
    }
  },
};

