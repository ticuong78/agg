import type { Role } from '@agg/contracts';

/** Port: keyed hashing of one-time codes, constant-time comparison. */
export abstract class CodeHasher {
  abstract hash(email: string, code: string): string;
  abstract matches(email: string, code: string, hash: string): boolean;
}

export interface TokenClaims {
  sub: string;
  email: string;
  role: Role;
}

/** Port: signed session tokens. */
export abstract class TokenService {
  abstract issue(claims: TokenClaims): Promise<string>;
  abstract verify(token: string): Promise<TokenClaims | null>;
}

/** Which addresses are administrators (configuration). */
export abstract class AdminDirectory {
  abstract isAdmin(email: string): boolean;
}
