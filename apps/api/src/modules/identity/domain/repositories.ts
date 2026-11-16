import type { SignInCode } from './sign-in-code.js';
import type { User } from './user.js';

export abstract class UserRepository {
  abstract findById(id: string): Promise<User | null>;
  abstract findByEmail(email: string): Promise<User | null>;
  abstract findByReferralCode(code: string): Promise<User | null>;
  abstract findManyByIds(ids: string[]): Promise<User[]>;
  abstract save(user: User): Promise<void>;
  abstract delete(id: string): Promise<void>;
}

export abstract class SignInCodeRepository {
  abstract find(email: string): Promise<SignInCode | null>;
  /** One live code per address: a new one replaces the previous. */
  abstract save(code: SignInCode): Promise<void>;
  abstract delete(email: string): Promise<void>;
}
