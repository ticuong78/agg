import { newId } from '../../../shared/domain/aggregate-root.js';

export interface ReferralState {
  id: string;
  referrerUserId: string;
  refereeUserId: string;
  /** SIGNED_UP when the invited teacher created an account; QUALIFIED after their first finished conversion. */
  status: 'SIGNED_UP' | 'QUALIFIED';
  createdAt: Date;
  qualifiedAt: Date | null;
}

/**
 * Aggregate: one teacher brought by another. The referrer is rewarded only once the new account really used the
 * product, so creating throw-away accounts earns nothing.
 */
export class Referral {
  private constructor(private state: ReferralState) {}

  static signedUp(referrerUserId: string, refereeUserId: string, now = new Date()): Referral {
    return new Referral({ id: newId(), referrerUserId, refereeUserId, status: 'SIGNED_UP', createdAt: now, qualifiedAt: null });
  }

  static restore(state: ReferralState): Referral {
    return new Referral({ ...state });
  }

  get id(): string { return this.state.id; }
  get referrerUserId(): string { return this.state.referrerUserId; }
  snapshot(): ReferralState { return { ...this.state }; }

  /** Returns true the first time only. */
  qualify(now = new Date()): boolean {
    if (this.state.status === 'QUALIFIED') return false;
    this.state.status = 'QUALIFIED';
    this.state.qualifiedAt = now;
    return true;
  }
}
