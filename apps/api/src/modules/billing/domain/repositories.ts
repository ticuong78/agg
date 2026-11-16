import type { Order } from './order.js';
import type { Subscription } from './subscription.js';
import type { LedgerLine, OwnerKind, Wallet } from './wallet.js';
import type { Workspace } from './workspace.js';

export abstract class WalletRepository {
  abstract find(ownerKind: OwnerKind, ownerId: string): Promise<Wallet | null>;
  /**
   * Loads (or opens) the wallet with a row lock, runs `work`, then saves the wallet and its ledger lines in the same
   * transaction: two requests spending at once cannot both take the last credits.
   */
  abstract transact<T>(ownerKind: OwnerKind, ownerId: string, work: (wallet: Wallet) => T | Promise<T>): Promise<T>;
  abstract ledger(walletId: string, limit: number): Promise<LedgerLine[]>;
  /** Erasure: the wallet and its ledger. */
  abstract deleteOwner(ownerKind: OwnerKind, ownerId: string): Promise<void>;
  /** Credits spent per member of a wallet since a date (workspace usage view). */
  abstract spentByUser(walletId: string, since: Date): Promise<Map<string, number>>;
}

export abstract class SubscriptionRepository {
  abstract findByOwner(ownerKind: OwnerKind, ownerId: string): Promise<Subscription | null>;
  abstract listDue(now: Date): Promise<Subscription[]>;
  abstract deleteOwner(ownerKind: OwnerKind, ownerId: string): Promise<void>;
  abstract save(subscription: Subscription): Promise<void>;
}

export abstract class OrderRepository {
  abstract findById(id: string): Promise<Order | null>;
  abstract findByCode(code: string): Promise<Order | null>;
  abstract listByBuyer(userId: string, limit: number): Promise<Order[]>;
  abstract listPendingOlderThan(date: Date): Promise<Order[]>;
  abstract save(order: Order): Promise<void>;
}

export abstract class WorkspaceRepository {
  abstract findById(id: string): Promise<Workspace | null>;
  abstract findByOwner(userId: string): Promise<Workspace | null>;
  /** The workspace that lists this account or address as a member (joined or invited). */
  abstract findByMember(userId: string, email: string): Promise<Workspace | null>;
  abstract save(workspace: Workspace): Promise<void>;
  abstract delete(id: string): Promise<void>;
}

/** Conversions counted per subject (visitor, address, account) and day, for the daily allowance. */
export abstract class DailyUsageRepository {
  /** Increments every key for `day` unless one of them already reached its limit; returns whether it counted. */
  abstract incrementIfBelow(counters: { key: string; limit: number }[], day: string): Promise<boolean>;
  abstract count(key: string, day: string): Promise<number>;
}
