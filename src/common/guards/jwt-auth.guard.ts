/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { AuthGuard } from '@nestjs/passport';
import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_OPTIONAL_AUTH_KEY } from 'src/common/decorators/optional-auth.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isOptionalAuth =
      this.reflector.get<boolean>(IS_OPTIONAL_AUTH_KEY, context.getHandler()) ||
      this.reflector.get<boolean>(IS_OPTIONAL_AUTH_KEY, context.getClass());
    try {
      return (await super.canActivate(context)) as boolean;
    } catch (error) {
      if (isOptionalAuth) {
        const request = context.switchToHttp().getRequest();
        request.user = { role: 'GUEST', userId: null };
        return true;
      }
      throw new UnauthorizedException('You have to login first!');
    }
  }
}
