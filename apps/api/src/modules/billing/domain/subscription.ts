import { TierCatalog, type BillingPeriod, type PaidTier } from '@agg/contracts';
import { addDays, newId } from '../../../shared/domain/aggregate-root.js';
import { months } from './pricing.js';
import type { OwnerKind } from './wallet.js';

/** Monthly plan credits stay usable one extra month (rollover), then expire. */
export const PLAN_CREDIT_LIFETIME_DAYS = 60;
const MONTH_DAYS = 30;

export interface SubscriptionState {
  id: string;
  ownerKind: OwnerKind;
  ownerId: string;
  tier: PaidTier;
  period: BillingPeriod;
  extraSeats: number;
  startsAt: Date;
  endsAt: Date;
  /** When the next month of credits is due. */
  nextGrantAt: Date;
  /** Grants already made, numbered from 1: the grant reference is `<id>:<n>`. */
  grantsMade: number;
}

/**
 * Aggregate: a prepaid plan period. VNPay, MoMo and bank transfers have no recurring billing, so a plan is bought
 * for one or twelve months; buying again before the end extends it. Credits are granted month by month.
 */
export class Subscription {
  private constructor(private state: SubscriptionState) {}

  static start(ownerKind: OwnerKind, ownerId: string, tier: PaidTier, period: BillingPeriod, extraSeats: number, now = new Date()): Subscription {
    return new Subscription({
      id: newId(), ownerKind, ownerId, tier, period, extraSeats,
      startsAt: now, endsAt: addDays(now, months(period) * MONTH_DAYS), nextGrantAt: now, grantsMade: 0,
    });
  }

  static restore(state: SubscriptionState): Subscription {
    return new Subscription({ ...state });
  }

  get tier(): PaidTier { return this.state.tier; }
  get period(): BillingPeriod { return this.state.period; }
  get endsAt(): Date { return this.state.endsAt; }
  get ownerKind(): OwnerKind { return this.state.ownerKind; }
  get ownerId(): string { return this.state.ownerId; }
  get seatLimit(): number { return TierCatalog[this.state.tier].seats + this.state.extraSeats; }
  snapshot(): SubscriptionState { return { ...this.state }; }

  isActive(now = new Date()): boolean {
    return this.state.startsAt <= now && now < this.state.endsAt;
  }

  /** Same tier bought again: more time (and the larger seat count). An upgrade replaces the plan from now on. */
  renew(tier: PaidTier, period: BillingPeriod, extraSeats: number, now = new Date()): void {
    const from = this.isActive(now) && tier === this.state.tier ? this.state.endsAt : now;
    if (tier !== this.state.tier || !this.isActive(now)) {
      this.state.startsAt = now;
      this.state.nextGrantAt = now;
    }
    this.state.tier = tier;
    this.state.period = period;
    this.state.extraSeats = Math.max(this.state.extraSeats, extraSeats);
    this.state.endsAt = addDays(from, months(period) * MONTH_DAYS);
  }

  /** Monthly grants that are due now: [reference, credits, expiry]. The caller adds them to the wallet. */
  dueGrants(now = new Date()): { reference: string; credits: number; expiresAt: Date }[] {
    const grants: { reference: string; credits: number; expiresAt: Date }[] = [];
    while (this.state.nextGrantAt <= now && this.state.nextGrantAt < this.state.endsAt) {
      this.state.grantsMade++;
      grants.push({
        reference: `${this.state.id}:${this.state.grantsMade}`,
        credits: TierCatalog[this.state.tier].monthlyCredits,
        expiresAt: addDays(this.state.nextGrantAt, PLAN_CREDIT_LIFETIME_DAYS),
      });
      this.state.nextGrantAt = addDays(this.state.nextGrantAt, MONTH_DAYS);
    }
    return grants;
  }
}
