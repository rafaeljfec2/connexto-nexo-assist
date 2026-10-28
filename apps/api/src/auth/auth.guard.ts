import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';

export type AuthedRequest = Request & {
  user?: {
    id: string;
    email: string;
    name: string;
    area: string;
    role: 'employee' | 'analyst';
  };
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const token = readSessionCookie(req);
    req.user = await this.auth.resolveSession(token);
    return true;
  }
}

@Injectable()
export class AnalystGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const token = readSessionCookie(req);
    const user = await this.auth.resolveSession(token);
    if (user.role !== 'analyst') {
      throw new ForbiddenException('Acesso restrito a analistas.');
    }
    req.user = user;
    return true;
  }
}

@Injectable()
export class EmployeeGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const token = readSessionCookie(req);
    const user = await this.auth.resolveSession(token);
    if (user.role !== 'employee') {
      throw new ForbiddenException('Acesso restrito a funcionários.');
    }
    req.user = user;
    return true;
  }
}

export function readSessionCookie(req: Request): string | undefined {
  const cookies = req.cookies as Record<string, string> | undefined;
  return cookies?.['nexo_session'];
}
