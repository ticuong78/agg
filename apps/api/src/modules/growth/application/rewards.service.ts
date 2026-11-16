import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  RewardCredits, type BugReportRequest, type FeedbackRequest, type ResearchSignupRequest, type ReviewDecisionRequest, type ReviewItemDto,
  type RewardActivity, type RewardResultDto, type RewardsDto, type SurveyRequest,
} from '@agg/contracts';
import type { UserRequester } from '../../../shared/application/requester.js';
import { assert, DomainError } from '../../../shared/domain/domain-error.js';
import { CONVERSION_COMPLETED, type ConversionCompleted } from '../../conversion/conversion.events.js';
import { USER_REGISTERED, type UserRegistered } from '../../identity/identity.events.js';
import { Referral } from '../domain/referral.js';
import { ReferralRepository, RewardClaimRepository } from '../domain/repositories.js';
import { RewardClaim, RewardPolicy } from '../domain/reward-claim.js';
import { LeadService } from './lead.service.js';
import { CreditGranter, GrowthIdentityPort } from './ports.js';
import { VisitorRepository } from '../domain/repositories.js';

const REASONS: Record<RewardActivity, string> = {
  SURVEY: 'Thưởng làm khảo sát',
  REFERRAL: 'Thưởng giới thiệu bạn bè',
  REFERRED_SIGNUP: 'Quà đăng ký qua lời giới thiệu',
  FEEDBACK: 'Thưởng góp ý sản phẩm',
  BUG_REPORT: 'Thưởng báo lỗi',
  USER_RESEARCH: 'Thưởng tham gia phỏng vấn người dùng',
};

/** Earn credits: survey (also the richest lead data), referrals, feedback, bug reports, research sessions. */
@Injectable()
export class RewardsService {
  private readonly logger = new Logger(RewardsService.name);

  constructor(
    private readonly claims: RewardClaimRepository,
    private readonly referrals: ReferralRepository,
    private readonly visitors: VisitorRepository,
    private readonly credits: CreditGranter,
    private readonly identity: GrowthIdentityPort,
    private readonly leads: LeadService,
  ) {}

  async overview(requester: UserRequester): Promise<RewardsDto> {
    const user = await this.identity.find(requester.userId);
    if (!user) throw DomainError.unauthorized('auth.required', 'Vui lòng đăng nhập.');
    const history = await this.claims.history(requester.userId);
    const monthAgo = new Date(Date.now() - 30 * 86_400_000);
    const status = (activity: RewardActivity) => RewardPolicy.canSubmit(activity, history);
    const activity = (a: RewardActivity, credits: number, detail: string) => {
      const s = status(a);
      return { activity: a, credits, available: s.allowed, detail: s.allowed ? detail : s.reason };
    };
    return {
      activities: [
        activity('SURVEY', RewardCredits.SURVEY, 'Trả lời 2 phút về cách bạn ra đề và chấm bài.'),
        activity('REFERRAL', RewardCredits.REFERRAL, `Bạn nhận ${RewardCredits.REFERRAL} credit khi người được giới thiệu đăng ký và chuyển đổi bộ đề đầu tiên; họ nhận ${RewardCredits.REFERRED_SIGNUP} credit.`),
        activity('FEEDBACK', RewardCredits.FEEDBACK, 'Cho chúng tôi biết điều bạn thích và chưa thích (mỗi 30 ngày).'),
        activity('BUG_REPORT', RewardCredits.BUG_REPORT_MAX, `Báo lỗi được xác nhận nhận ${RewardCredits.BUG_REPORT_MIN}–${RewardCredits.BUG_REPORT_MAX} credit tuỳ mức độ.`),
        activity('USER_RESEARCH', RewardCredits.USER_RESEARCH, 'Trò chuyện 30 phút qua video với nhóm sản phẩm.'),
      ],
      referralCode: user.referralCode,
      referralsThisMonth: await this.referrals.countByReferrer(requester.userId, monthAgo),
      referralsTotal: await this.referrals.countByReferrer(requester.userId, null),
      creditsEarned: history.filter((c) => c.status === 'APPROVED').reduce((sum, c) => sum + c.credits, 0),
    };
  }

  /** The survey doubles as the lead profile: answers are merged into the user's lead. */
  async survey(requester: UserRequester, body: SurveyRequest): Promise<RewardResultDto> {
    const result = await this.submit(requester, 'SURVEY', 'Khảo sát', { ...body });
    const user = await this.identity.find(requester.userId);
    if (user) {
      await this.leads.upsert({
        email: user.email, source: 'SURVEY', name: user.name, userId: user.id, visitorId: requester.visitorId,
        organization: body.organization, phone: body.contactConsent ? body.phone : undefined,
        marketingConsent: body.contactConsent ? true : undefined,
        attributes: {
          role: body.role, organizationType: body.organizationType, province: body.province, subjects: body.subjects.join(', '),
          studentsCount: body.studentsCount, currentTools: body.currentTools.join(', '), painPoints: body.painPoints,
          interestedFeatures: body.interestedFeatures.join(', '),
        },
      });
    }
    return result;
  }

  async feedback(requester: UserRequester, body: FeedbackRequest): Promise<RewardResultDto> {
    assert(body.message.trim().length >= 20, 'feedback.too_short', 'Góp ý cần ít nhất 20 ký tự để chúng tôi hiểu rõ.');
    return this.submit(requester, 'FEEDBACK', `Góp ý ${body.rating}/5`, { ...body });
  }

  async bugReport(requester: UserRequester, body: BugReportRequest): Promise<RewardResultDto> {
    return this.submit(requester, 'BUG_REPORT', body.title, { ...body });
  }

  async research(requester: UserRequester, body: ResearchSignupRequest): Promise<RewardResultDto> {
    const result = await this.submit(requester, 'USER_RESEARCH', 'Đăng ký phỏng vấn người dùng', { ...body });
    const user = await this.identity.find(requester.userId);
    if (user) {
      await this.leads.upsert({
        email: user.email, source: 'RESEARCH_SIGNUP', userId: user.id, phone: body.phone,
        attributes: { researchAvailability: body.availability },
      });
    }
    return result;
  }

  private async submit(requester: UserRequester, activity: RewardActivity, title: string, payload: Record<string, unknown>): Promise<RewardResultDto> {
    const policy = RewardPolicy.canSubmit(activity, await this.claims.history(requester.userId));
    if (!policy.allowed) throw DomainError.conflict('reward.not_available', policy.reason);
    const claim = RewardClaim.submit(requester.userId, activity, title, payload);
    await this.claims.save(claim);
    if (claim.status === 'APPROVED' && claim.credits > 0) {
      await this.credits.grant(requester.userId, claim.credits, `reward:${claim.id}`, REASONS[activity]);
      return { creditsGranted: claim.credits, pendingReview: false, message: `Cảm ơn bạn! Đã cộng ${claim.credits} credit.` };
    }
    return { creditsGranted: 0, pendingReview: true, message: 'Cảm ơn bạn! Chúng tôi sẽ kiểm tra và cộng credit khi xác nhận.' };
  }

  // ---------- Admin review ----------

  async pending(): Promise<ReviewItemDto[]> {
    const claims = await this.claims.listPending(200);
    const users = await this.identity.findMany([...new Set(claims.map((c) => c.userId))]);
    return claims.map((c) => {
      const s = c.snapshot();
      return {
        id: s.id,
        kind: s.activity === 'BUG_REPORT' ? 'BUG_REPORT' : 'USER_RESEARCH',
        userEmail: users.find((u) => u.id === s.userId)?.email ?? '',
        title: s.title,
        body: JSON.stringify(s.payload, null, 2),
        status: s.status,
        createdAt: s.createdAt.toISOString(),
      };
    });
  }

  async decide(id: string, body: ReviewDecisionRequest): Promise<void> {
    const claim = await this.claims.findById(id);
    if (!claim) throw DomainError.notFound('reward.not_found', 'Không tìm thấy yêu cầu.');
    claim.decide(body.approve, body.credits, body.note);
    await this.claims.save(claim);
    if (claim.status === 'APPROVED') await this.credits.grant(claim.userId, claim.credits, `reward:${claim.id}`, REASONS[claim.activity]);
  }

  // ---------- Reactions ----------

  @OnEvent(USER_REGISTERED, { async: true, promisify: true })
  async onRegistered(event: UserRegistered): Promise<void> {
    await this.leads.upsert({
      email: event.email, source: 'SIGNUP', name: event.displayName, userId: event.userId,
      visitorId: event.visitorId, marketingConsent: event.marketingConsent,
    });
    if (event.visitorId) {
      const visitor = await this.visitors.find(event.visitorId);
      if (visitor) {
        visitor.linkUser(event.userId);
        await this.visitors.save(visitor);
      }
    }
    if (event.referredByUserId && event.referredByUserId !== event.userId) {
      await this.referrals.save(Referral.signedUp(event.referredByUserId, event.userId));
      const claim = RewardClaim.submit(event.userId, 'REFERRED_SIGNUP', 'Đăng ký qua lời giới thiệu', { referrer: event.referredByUserId });
      await this.claims.save(claim);
      await this.credits.grant(event.userId, claim.credits, `reward:${claim.id}`, REASONS.REFERRED_SIGNUP);
    }
  }

  /** The referred teacher finished a conversion: the referral counts, the referrer is rewarded (within the monthly cap). */
  @OnEvent(CONVERSION_COMPLETED, { async: true, promisify: true })
  async onConversion(event: ConversionCompleted): Promise<void> {
    if (!event.ownerUserId) return;
    const referral = await this.referrals.findByReferee(event.ownerUserId);
    if (!referral || !referral.qualify()) return;
    await this.referrals.save(referral);
    const policy = RewardPolicy.canSubmit('REFERRAL', await this.claims.history(referral.referrerUserId));
    if (!policy.allowed) {
      this.logger.log('Referral qualified past the monthly cap: no reward');
      return;
    }
    const claim = RewardClaim.submit(referral.referrerUserId, 'REFERRAL', 'Giới thiệu bạn bè', { referral: referral.id });
    await this.claims.save(claim);
    await this.credits.grant(referral.referrerUserId, claim.credits, `reward:${claim.id}`, REASONS.REFERRAL);
  }
}
