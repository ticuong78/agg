import { DomainError } from '../../../shared/domain/domain-error.js';

export const CODE_TTL_MINUTES = 10;
export const MAX_CODE_ATTEMPTS = 5;

export interface SignInCodeState {
  email: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
}

/**
 * A one-time code sent to an address. Only its hash is kept; it expires, and it is burnt after a few wrong
 * attempts, so guessing six digits is not practical.
 */
export class SignInCode {
  private constructor(private state: SignInCodeState) {}

  static issue(email: string, codeHash: string, now = new Date()): SignInCode {
    return new SignInCode({ email, codeHash, expiresAt: new Date(now.getTime() + CODE_TTL_MINUTES * 60_000), attempts: 0 });
  }

  static restore(state: SignInCodeState): SignInCode {
    return new SignInCode({ ...state });
  }

  snapshot(): SignInCodeState { return { ...this.state }; }

  /** Records the attempt; throws when the code cannot be accepted. `matches` compares hashes in constant time. */
  verify(matches: (hash: string) => boolean, now = new Date()): void {
    if (this.state.expiresAt <= now || this.state.attempts >= MAX_CODE_ATTEMPTS) {
      throw DomainError.validation('auth.code_expired', 'Mã đã hết hạn. Hãy yêu cầu mã mới.');
    }
    this.state.attempts++;
    if (!matches(this.state.codeHash)) {
      const left = MAX_CODE_ATTEMPTS - this.state.attempts;
      throw DomainError.validation('auth.code_invalid', left > 0 ? `Mã không đúng. Còn ${left} lần thử.` : 'Mã không đúng. Hãy yêu cầu mã mới.');
    }
  }
}
