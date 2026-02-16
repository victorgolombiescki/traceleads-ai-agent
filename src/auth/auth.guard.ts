import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UNAUTHED_ERR_MSG } from '../../shared/const';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = await this.authService.authenticateRequest(request);
    
    if (!user) {
      throw new UnauthorizedException(UNAUTHED_ERR_MSG);
    }
    
    request['user'] = user;
    return true;
  }
}


