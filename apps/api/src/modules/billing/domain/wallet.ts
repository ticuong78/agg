import type { CreditSource } from '@agg/contracts';
import { newId } from '../../../shared/domain/aggregate-root.js';
import { assert, DomainError } from '../../../shared/domain/domain-error.js';

export type OwnerKind = 'USER' | 'WORKSPACE';

export interface CreditBucket {
  id: string;
  source: CreditSource;
  granted: number;
  remaining: number;
  grantedAt: Date;
  expiresAt: Date | null;
  /** What granted it (order id, reward id, "2026-11" for a monthly refill). Unique per wallet: grants are idempotent. */
  reference: string;
}

export interface LedgerLine {
  id: string;
  walletId: string;
  /** The member who spent (workspace wallets), or the owner. */
  userId: string | null;
  amount: number;
  reason: string;
  reference: string | null;
  at: Date;
}

export interface WalletState {
  id: string;
  ownerKind: OwnerKind;
  ownerId: string;
  buckets: CreditBucket[];
}

/**
 * Aggregate: the credits of an account or of a workspace's shared pool, kept as buckets with their own expiry.
 * Spending takes from the bucket that expires first, so nobody loses credits they could have used.
 */
export class Wallet {
  private lines: LedgerLine[] = [];

  private constructor(private state: WalletState) {}

  static open(ownerKind: OwnerKind, ownerId: string): Wallet {
    return new Wallet({ id: newId(), ownerKind, ownerId, buckets: [] });
  }

  static restore(state: WalletState): Wallet {
    // Buckets may come back from JSON storage with dates as strings.
    return new Wallet({
      ...state,
      buckets: state.buckets.map((b) => ({ ...b, grantedAt: new Date(b.grantedAt), expiresAt: b.expiresAt ? new Date(b.expiresAt) : null })),
    });
  }

  get id(): string { return this.state.id; }
  get ownerKind(): OwnerKind { return this.state.ownerKind; }
  get ownerId(): string { return this.state.ownerId; }
  snapshot(): WalletState { return { ...this.state, buckets: this.state.buckets.map((b) => ({ ...b })) }; }

  /** Ledger lines recorded since the wallet was loaded; the repository writes them with the wallet. */
  pullLines(): LedgerLine[] {
    const lines = this.lines;
    this.lines = [];
    return lines;
  }

  live(now = new Date()): CreditBucket[] {
    return this.state.buckets
      .filter((b) => b.remaining > 0 && (!b.expiresAt || b.expiresAt > now))
      .sort((a, b) => (a.expiresAt?.getTime() ?? Infinity) - (b.expiresAt?.getTime() ?? Infinity));
  }

  balance(now = new Date()): number {
    return this.live(now).reduce((sum, b) => sum + b.remaining, 0);
  }

  hasGrant(reference: string): boolean {
    return this.state.buckets.some((b) => b.reference === reference);
  }

  /** Adds credits. A second grant with the same reference does nothing (webhooks and events may repeat). */
  grant(source: CreditSource, amount: number, expiresAt: Date | null, reference: string, reason: string, now = new Date()): boolean {
    assert(Number.isInteger(amount) && amount > 0, 'wallet.invalid_amount', 'Số credit không hợp lệ.');
    if (this.hasGrant(reference)) return false;
    this.state.buckets.push({ id: newId(), source, granted: amount, remaining: amount, grantedAt: now, expiresAt, reference });
    this.line(null, amount, reason, reference, now);
    this.prune(now);
    return true;
  }

  /** Free accounts are topped up to `cap` once per month, never above it. */
  refill(source: CreditSource, cap: number, monthly: number, reference: string, expiresAt: Date | null, reason: string, now = new Date()): void {
    if (this.hasGrant(reference)) return;
    const amount = Math.min(monthly, Math.max(0, cap - this.balance(now)));
    if (amount > 0) this.grant(source, amount, expiresAt, reference, reason, now);
    // Remember the month even when nothing was added, so the check is not repeated.
    else this.state.buckets.push({ id: newId(), source, granted: 0, remaining: 0, grantedAt: now, expiresAt: now, reference });
  }

  spend(amount: number, userId: string | null, reason: string, reference: string, now = new Date()): number {
    assert(Number.isInteger(amount) && amount > 0, 'wallet.invalid_amount', 'Số credit không hợp lệ.');
    const balance = this.balance(now);
    if (balance < amount) {
      throw DomainError.paymentRequired('credits.insufficient',
        `Không đủ credit: cần ${amount}, còn ${balance}. Hãy mua thêm credit hoặc nâng cấp gói.`, { action: 'upgrade', needed: String(amount), balance: String(balance) });
    }
    let left = amount;
    for (const bucket of this.live(now)) {
      const take = Math.min(bucket.remaining, left);
      bucket.remaining -= take;
      left -= take;
      if (!left) break;
    }
    this.line(userId, -amount, reason, reference, now);
    return balance - amount;
  }

  private line(userId: string | null, amount: number, reason: string, reference: string | null, at: Date) {
    this.lines.push({ id: newId(), walletId: this.state.id, userId, amount, reason, reference, at });
  }

  /** Buckets that are empty and older than a year only clutter the row. Grants keep their reference for idempotency. */
  private prune(now: Date) {
    const yearAgo = now.getTime() - 366 * 86_400_000;
    this.state.buckets = this.state.buckets.filter((b) => b.remaining > 0 || b.grantedAt.getTime() > yearAgo);
  }
}
