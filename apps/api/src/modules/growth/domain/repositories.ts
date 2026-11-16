import type { Lead } from './lead.js';
import type { Referral } from './referral.js';
import type { RewardClaim, RewardClaimState } from './reward-claim.js';
import type { Visitor } from './visitor.js';

export abstract class VisitorRepository {
  abstract find(id: string): Promise<Visitor | null>;
  abstract save(visitor: Visitor): Promise<void>;
  abstract deleteByUser(userId: string): Promise<void>;
  abstract deleteNotSeenSince(date: Date): Promise<number>;
}

export abstract class LeadRepository {
  abstract findByEmail(email: string): Promise<Lead | null>;
  abstract list(offset: number, limit: number, search: string | null): Promise<{ items: Lead[]; total: number }>;
  abstract save(lead: Lead): Promise<void>;
  abstract deleteByEmail(email: string): Promise<void>;
}

export abstract class RewardClaimRepository {
  abstract findById(id: string): Promise<RewardClaim | null>;
  abstract history(userId: string): Promise<RewardClaimState[]>;
  abstract listPending(limit: number): Promise<RewardClaim[]>;
  abstract save(claim: RewardClaim): Promise<void>;
  abstract deleteByUser(userId: string): Promise<void>;
}

export abstract class ReferralRepository {
  abstract findByReferee(refereeUserId: string): Promise<Referral | null>;
  abstract countByReferrer(referrerUserId: string, since: Date | null): Promise<number>;
  abstract save(referral: Referral): Promise<void>;
  abstract deleteByUser(userId: string): Promise<void>;
}

export interface AnalyticsEvent {
  visitorId: string | null;
  userId: string | null;
  name: string;
  path: string | null;
  props: Record<string, string | number | boolean>;
  at: Date;
}

export abstract class AnalyticsEventRepository {
  abstract append(events: AnalyticsEvent[]): Promise<void>;
  abstract deleteOlderThan(date: Date): Promise<number>;
  abstract deleteByUser(userId: string): Promise<void>;
}
