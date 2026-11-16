import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { LeadSource, ReviewStatus, RewardActivity } from '@agg/contracts';
import { Column, Entity, ILike, Index, LessThan, MoreThan, PrimaryColumn, PrimaryGeneratedColumn, type Repository } from 'typeorm';
import { Lead } from '../domain/lead.js';
import { Referral } from '../domain/referral.js';
import {
  AnalyticsEventRepository, LeadRepository, ReferralRepository, RewardClaimRepository, VisitorRepository, type AnalyticsEvent,
} from '../domain/repositories.js';
import { RewardClaim } from '../domain/reward-claim.js';
import { Visitor, type Attribution } from '../domain/visitor.js';

@Entity('visitors')
export class VisitorOrmEntity {
  @PrimaryColumn('uuid') id: string;
  @Column({ name: 'first_seen_at', type: 'timestamptz' }) firstSeenAt: Date;
  @Column({ name: 'last_seen_at', type: 'timestamptz' }) lastSeenAt: Date;
  @Column({ type: 'jsonb' }) attribution: Attribution;
  @Column({ name: 'user_agent', type: 'varchar', length: 300, nullable: true }) userAgent: string | null;
  @Column({ type: 'varchar', length: 20, nullable: true }) language: string | null;
  @Column({ name: 'ip_hash', type: 'varchar', length: 64 }) ipHash: string;
  @Column({ type: 'varchar', length: 2, nullable: true }) country: string | null;
  @Column({ name: 'analytics_consent', type: 'boolean', default: false }) analyticsConsent: boolean;
  @Column({ name: 'marketing_consent', type: 'boolean', default: false }) marketingConsent: boolean;
  @Column({ name: 'consent_at', type: 'timestamptz', nullable: true }) consentAt: Date | null;
  @Index() @Column({ name: 'user_id', type: 'uuid', nullable: true }) userId: string | null;
  @Column({ type: 'int', default: 1 }) visits: number;
}

@Entity('leads')
export class LeadOrmEntity {
  @PrimaryColumn('uuid') id: string;
  @Index({ unique: true }) @Column({ type: 'varchar', length: 254 }) email: string;
  @Column({ type: 'varchar', length: 120, nullable: true }) name: string | null;
  @Column({ type: 'varchar', length: 30, nullable: true }) phone: string | null;
  @Column({ type: 'varchar', length: 200, nullable: true }) organization: string | null;
  @Column({ type: 'jsonb' }) sources: LeadSource[];
  @Column({ name: 'marketing_consent', type: 'boolean', default: false }) marketingConsent: boolean;
  @Column({ name: 'consent_at', type: 'timestamptz', nullable: true }) consentAt: Date | null;
  @Column({ name: 'user_id', type: 'uuid', nullable: true }) userId: string | null;
  @Column({ name: 'visitor_ids', type: 'jsonb' }) visitorIds: string[];
  @Column({ type: 'jsonb' }) attributes: Record<string, string>;
  @Column({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @Index() @Column({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}

@Entity('reward_claims')
export class RewardClaimOrmEntity {
  @PrimaryColumn('uuid') id: string;
  @Index() @Column({ name: 'user_id', type: 'uuid' }) userId: string;
  @Column({ type: 'varchar', length: 20 }) activity: RewardActivity;
  @Index() @Column({ type: 'varchar', length: 10 }) status: ReviewStatus;
  @Column({ type: 'int', default: 0 }) credits: number;
  @Column({ type: 'varchar', length: 200 }) title: string;
  @Column({ type: 'jsonb' }) payload: Record<string, unknown>;
  @Column({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true }) decidedAt: Date | null;
  @Column({ type: 'varchar', length: 500, nullable: true }) note: string | null;
}

@Entity('referrals')
export class ReferralOrmEntity {
  @PrimaryColumn('uuid') id: string;
  @Index() @Column({ name: 'referrer_user_id', type: 'uuid' }) referrerUserId: string;
  @Index({ unique: true }) @Column({ name: 'referee_user_id', type: 'uuid' }) refereeUserId: string;
  @Column({ type: 'varchar', length: 10 }) status: 'SIGNED_UP' | 'QUALIFIED';
  @Column({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @Column({ name: 'qualified_at', type: 'timestamptz', nullable: true }) qualifiedAt: Date | null;
}

@Entity('analytics_events')
@Index(['name', 'at'])
export class AnalyticsEventOrmEntity {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' }) id: string;
  @Column({ name: 'visitor_id', type: 'uuid', nullable: true }) visitorId: string | null;
  @Column({ name: 'user_id', type: 'uuid', nullable: true }) userId: string | null;
  @Column({ type: 'varchar', length: 60 }) name: string;
  @Column({ type: 'varchar', length: 300, nullable: true }) path: string | null;
  @Column({ type: 'jsonb' }) props: Record<string, string | number | boolean>;
  @Column({ type: 'timestamptz' }) at: Date;
}

@Injectable()
export class TypeOrmVisitorRepository extends VisitorRepository {
  constructor(@InjectRepository(VisitorOrmEntity) private readonly repo: Repository<VisitorOrmEntity>) {
    super();
  }
  async find(id: string) {
    const row = await this.repo.findOneBy({ id });
    return row ? Visitor.restore(row) : null;
  }
  async deleteByUser(userId: string) {
    await this.repo.delete({ userId });
  }
  async deleteNotSeenSince(date: Date) {
    return (await this.repo.delete({ lastSeenAt: LessThan(date) })).affected ?? 0;
  }
  async save(visitor: Visitor) {
    await this.repo.save(visitor.snapshot());
  }
}

@Injectable()
export class TypeOrmLeadRepository extends LeadRepository {
  constructor(@InjectRepository(LeadOrmEntity) private readonly repo: Repository<LeadOrmEntity>) {
    super();
  }
  async findByEmail(email: string) {
    const row = await this.repo.findOneBy({ email });
    return row ? Lead.restore(row) : null;
  }
  async list(offset: number, limit: number, search: string | null) {
    const like = search ? `%${search.replace(/[%_]/g, '')}%` : null;
    const [rows, total] = await this.repo.findAndCount({
      where: like ? [{ email: ILike(like) }, { organization: ILike(like) }, { name: ILike(like) }] : {},
      order: { updatedAt: 'DESC' },
      skip: offset,
      take: limit,
    });
    return { items: rows.map((r) => Lead.restore(r)), total };
  }
  async deleteByEmail(email: string) {
    await this.repo.delete({ email });
  }
  async save(lead: Lead) {
    await this.repo.save(lead.snapshot());
  }
}

@Injectable()
export class TypeOrmRewardClaimRepository extends RewardClaimRepository {
  constructor(@InjectRepository(RewardClaimOrmEntity) private readonly repo: Repository<RewardClaimOrmEntity>) {
    super();
  }
  async findById(id: string) {
    const row = await this.repo.findOneBy({ id });
    return row ? RewardClaim.restore(row) : null;
  }
  async history(userId: string) {
    return this.repo.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 500 });
  }
  async listPending(limit: number) {
    return (await this.repo.find({ where: { status: 'PENDING' }, order: { createdAt: 'ASC' }, take: limit })).map((r) => RewardClaim.restore(r));
  }
  async deleteByUser(userId: string) {
    await this.repo.delete({ userId });
  }
  async save(claim: RewardClaim) {
    await this.repo.save(claim.snapshot());
  }
}

@Injectable()
export class TypeOrmReferralRepository extends ReferralRepository {
  constructor(@InjectRepository(ReferralOrmEntity) private readonly repo: Repository<ReferralOrmEntity>) {
    super();
  }
  async findByReferee(refereeUserId: string) {
    const row = await this.repo.findOneBy({ refereeUserId });
    return row ? Referral.restore(row) : null;
  }
  async countByReferrer(referrerUserId: string, since: Date | null) {
    return this.repo.countBy(since ? { referrerUserId, createdAt: MoreThan(since) } : { referrerUserId });
  }
  async deleteByUser(userId: string) {
    await this.repo.delete({ refereeUserId: userId });
    await this.repo.delete({ referrerUserId: userId });
  }
  async save(referral: Referral) {
    await this.repo.save(referral.snapshot());
  }
}

@Injectable()
export class TypeOrmAnalyticsEventRepository extends AnalyticsEventRepository {
  constructor(@InjectRepository(AnalyticsEventOrmEntity) private readonly repo: Repository<AnalyticsEventOrmEntity>) {
    super();
  }
  async deleteByUser(userId: string) {
    await this.repo.delete({ userId });
  }
  async deleteOlderThan(date: Date) {
    return (await this.repo.delete({ at: LessThan(date) })).affected ?? 0;
  }
  async append(events: AnalyticsEvent[]) {
    await this.repo.insert(events);
  }
}
