import type { DomainEvent } from '../../shared/domain/aggregate-root.js';

export const USER_REGISTERED = 'identity.user_registered';

/** A first sign-in created an account. Billing grants welcome credits; growth records the lead and the referral. */
export class UserRegistered implements DomainEvent {
  readonly name = USER_REGISTERED;
  readonly occurredAt = new Date();
  constructor(
    readonly userId: string,
    readonly email: string,
    readonly displayName: string,
    readonly referredByUserId: string | null,
    readonly visitorId: string | null,
    readonly marketingConsent: boolean,
  ) {}
}

export const ACCOUNT_DELETED = 'identity.account_deleted';

/** The user asked to delete their account: every context erases what it holds about them. */
export class AccountDeleted implements DomainEvent {
  readonly name = ACCOUNT_DELETED;
  readonly occurredAt = new Date();
  constructor(
    readonly userId: string,
    readonly email: string,
  ) {}
}
