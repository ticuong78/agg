import type { Role } from '@agg/contracts';
import { randomBytes } from 'node:crypto';
import { AggregateRoot, newId } from '../../../shared/domain/aggregate-root.js';
import { assert } from '../../../shared/domain/domain-error.js';
import { Email } from '../../../shared/domain/email.js';
import { UserRegistered } from '../identity.events.js';

export interface UserState {
  id: string;
  email: string;
  name: string;
  role: Role;
  referralCode: string;
  referredByUserId: string | null;
  marketingConsent: boolean;
  createdAt: Date;
  lastSignInAt: Date | null;
}

const REFERRAL_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** A teacher's account. Accounts have no password: they sign in with a one-time code sent by e-mail. */
export class User extends AggregateRoot {
  private constructor(private state: UserState) {
    super(state.id);
  }

  static register(input: {
    email: Email;
    name?: string;
    role: Role;
    referredByUserId: string | null;
    marketingConsent: boolean;
    visitorId: string | null;
  }): User {
    const name = (input.name ?? '').trim().slice(0, 80) || input.email.value.split('@')[0];
    const user = new User({
      id: newId(),
      email: input.email.value,
      name,
      role: input.role,
      referralCode: User.newReferralCode(),
      referredByUserId: input.referredByUserId,
      marketingConsent: input.marketingConsent,
      createdAt: new Date(),
      lastSignInAt: new Date(),
    });
    user.record(new UserRegistered(user.id, user.email, name, input.referredByUserId, input.visitorId, input.marketingConsent));
    return user;
  }

  static restore(state: UserState): User {
    return new User({ ...state });
  }

  static newReferralCode(): string {
    const bytes = randomBytes(8);
    return Array.from(bytes, (b) => REFERRAL_ALPHABET[b % REFERRAL_ALPHABET.length]).join('');
  }

  get email(): string { return this.state.email; }
  get name(): string { return this.state.name; }
  get role(): Role { return this.state.role; }
  get referralCode(): string { return this.state.referralCode; }
  get marketingConsent(): boolean { return this.state.marketingConsent; }
  snapshot(): UserState { return { ...this.state }; }

  signedIn(role: Role): void {
    this.state.lastSignInAt = new Date();
    // ADMIN_EMAILS is the source of truth for administrators: removing an address demotes it at next sign-in.
    this.state.role = role;
  }

  updateProfile(changes: { name?: string; marketingConsent?: boolean }): void {
    if (changes.name !== undefined) {
      const name = changes.name.trim();
      assert(name.length >= 1 && name.length <= 80, 'user.invalid_name', 'Tên hiển thị phải từ 1 đến 80 ký tự.');
      this.state.name = name;
    }
    if (changes.marketingConsent !== undefined) this.state.marketingConsent = changes.marketingConsent;
  }
}
