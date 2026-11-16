import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { AdminDirectory, CodeHasher, TokenService, type TokenClaims } from '../application/ports.js';

/** HMAC-SHA256 keyed with the server secret: a leaked table of hashes cannot be brute-forced offline. */
@Injectable()
export class HmacCodeHasher extends CodeHasher {
  private readonly secret: string;

  constructor(config: ConfigService) {
    super();
    this.secret = config.getOrThrow<string>('JWT_SECRET');
  }

  hash(email: string, code: string): string {
    return createHmac('sha256', this.secret).update(`${email}:${code}`).digest('hex');
  }

  matches(email: string, code: string, hash: string): boolean {
    const a = Buffer.from(this.hash(email, code), 'hex');
    const b = Buffer.from(hash, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  }
}

@Injectable()
export class JwtTokenService extends TokenService {
  constructor(private readonly jwt: JwtService) {
    super();
  }

  issue(claims: TokenClaims): Promise<string> {
    return this.jwt.signAsync({ ...claims });
  }

  async verify(token: string): Promise<TokenClaims | null> {
    try {
      const payload = await this.jwt.verifyAsync<TokenClaims>(token);
      return payload?.sub ? payload : null;
    } catch {
      return null;
    }
  }
}

@Injectable()
export class EnvAdminDirectory extends AdminDirectory {
  private readonly emails: Set<string>;

  constructor(config: ConfigService) {
    super();
    this.emails = new Set((config.get<string>('ADMIN_EMAILS') ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean));
  }

  isAdmin(email: string): boolean {
    return this.emails.has(email.toLowerCase());
  }
}
