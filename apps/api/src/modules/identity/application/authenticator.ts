import { Injectable } from '@nestjs/common';
import { UserRepository } from '../domain/repositories.js';
import { TokenService } from './ports.js';

/** Turns a bearer token into the account behind it (the account must still exist). */
@Injectable()
export class Authenticator {
  constructor(
    private readonly tokens: TokenService,
    private readonly users: UserRepository,
  ) {}

  async authenticate(token: string): Promise<{ userId: string; email: string; role: 'USER' | 'ADMIN' } | null> {
    const claims = await this.tokens.verify(token);
    if (!claims) return null;
    const user = await this.users.findById(claims.sub);
    if (!user) return null;
    return { userId: user.id, email: user.email, role: user.role };
  }
}
