import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ACCOUNT_DELETED, type AccountDeleted } from '../../identity/identity.events.js';
import {
  AnalyticsEventRepository, LeadRepository, ReferralRepository, RewardClaimRepository, VisitorRepository,
} from '../domain/repositories.js';

/** A deleted account is also removed from the lead list, rewards, referrals and analytics. */
@Injectable()
export class GrowthErasure {
  constructor(
    private readonly leads: LeadRepository,
    private readonly claims: RewardClaimRepository,
    private readonly referrals: ReferralRepository,
    private readonly visitors: VisitorRepository,
    private readonly events: AnalyticsEventRepository,
  ) {}

  @OnEvent(ACCOUNT_DELETED, { async: true, promisify: true })
  async erase(event: AccountDeleted): Promise<void> {
    await this.leads.deleteByEmail(event.email);
    await this.claims.deleteByUser(event.userId);
    await this.referrals.deleteByUser(event.userId);
    await this.events.deleteByUser(event.userId);
    await this.visitors.deleteByUser(event.userId);
  }
}
