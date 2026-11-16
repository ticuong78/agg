import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { VISITOR_HEADER } from '@agg/contracts';
import type { Requester } from '../../../shared/application/requester.js';
import { DomainError } from '../../../shared/domain/domain-error.js';
import { hashIp } from '../../../shared/infrastructure/ip-hash.js';
import { ACCESS, type AccessLevel } from '../../../shared/presentation/decorators.js';
import { Authenticator } from '../application/authenticator.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Global guard. Every route must declare its access level (fail closed). It resolves who is calling:
 * an account (valid bearer token) or a guest (visitor id + hashed address), then enforces the level.
 */
@Injectable()
export class RequestGuard implements CanActivate {
  private readonly ipSecret: string;

  constructor(
    private readonly reflector: Reflector,
    private readonly authenticator: Authenticator,
    config: ConfigService,
  ) {
    this.ipSecret = config.get<string>('IP_HASH_SECRET') || config.getOrThrow<string>('JWT_SECRET');
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const level = this.reflector.getAllAndOverride<AccessLevel | undefined>(ACCESS, [ctx.getHandler(), ctx.getClass()]);
    if (!level) throw DomainError.forbidden('auth.route_not_declared', 'Đường dẫn này chưa được cấp quyền truy cập.');
    if (level === 'webhook') return true;

    const req = ctx.switchToHttp().getRequest();
    const rawVisitor = String(req.headers[VISITOR_HEADER] ?? '');
    const visitorId = UUID.test(rawVisitor) ? rawVisitor.toLowerCase() : null;
    const ipHash = hashIp(req.ip, this.ipSecret);

    const header: string | undefined = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    const account = token ? await this.authenticator.authenticate(token) : null;

    const requester: Requester = account
      ? { kind: 'user', userId: account.userId, email: account.email, role: account.role, visitorId, ipHash }
      : { kind: 'guest', visitorId, ipHash };
    req.requester = requester;

    if (level === 'guest') return true;
    if (requester.kind !== 'user') {
      throw DomainError.unauthorized('auth.required', token ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' : 'Vui lòng đăng nhập.');
    }
    if (level === 'admin' && requester.role !== 'ADMIN') {
      throw DomainError.forbidden('auth.forbidden', 'Bạn không có quyền thực hiện thao tác này.');
    }
    return true;
  }
}
