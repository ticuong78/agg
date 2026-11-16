import { FEEDBACK_COOLDOWN_DAYS, MAX_REFERRALS_PER_MONTH, RewardCredits, type ReviewStatus, type RewardActivity } from '@agg/contracts';
import { newId } from '../../../shared/domain/aggregate-root.js';
import { assert, DomainError } from '../../../shared/domain/domain-error.js';

export interface RewardClaimState {
  id: string;
  userId: string;
  activity: RewardActivity;
  status: ReviewStatus;
  credits: number;
  title: string;
  payload: Record<string, unknown>;
  createdAt: Date;
  decidedAt: Date | null;
  note: string | null;
}

/** Activities whose reward waits for a person to check them (a real bug, a research session that took place). */
const REVIEWED: RewardActivity[] = ['BUG_REPORT', 'USER_RESEARCH'];

/**
 * Aggregate: one activity a user did to earn credits. Instant activities are approved on creation; reviewed ones
 * wait for an administrator, who may set the amount within the published range.
 */
export class RewardClaim {
  private constructor(private state: RewardClaimState) {}

  static submit(userId: string, activity: RewardActivity, title: string, payload: Record<string, unknown>, now = new Date()): RewardClaim {
    const reviewed = REVIEWED.includes(activity);
    return new RewardClaim({
      id: newId(), userId, activity, status: reviewed ? 'PENDING' : 'APPROVED',
      credits: reviewed ? 0 : instantCredits(activity), title: title.slice(0, 200), payload, createdAt: now,
      decidedAt: reviewed ? null : now, note: null,
    });
  }

  static restore(state: RewardClaimState): RewardClaim {
    return new RewardClaim({ ...state });
  }

  get id(): string { return this.state.id; }
  get userId(): string { return this.state.userId; }
  get status(): ReviewStatus { return this.state.status; }
  get credits(): number { return this.state.credits; }
  get activity(): RewardActivity { return this.state.activity; }
  snapshot(): RewardClaimState { return { ...this.state }; }

  decide(approve: boolean, credits: number | undefined, note: string | undefined, now = new Date()): void {
    if (this.state.status !== 'PENDING') throw DomainError.conflict('reward.already_decided', 'Yêu cầu này đã được xử lý.');
    // Validate before changing anything: a refused amount leaves the claim pending.
    if (approve) {
      const amount = credits ?? defaultReviewedCredits(this.state.activity);
      const [min, max] = reviewedRange(this.state.activity);
      assert(Number.isInteger(amount) && amount >= min && amount <= max, 'reward.invalid_amount', `Số credit thưởng phải từ ${min} đến ${max}.`);
      this.state.credits = amount;
    }
    this.state.status = approve ? 'APPROVED' : 'REJECTED';
    this.state.decidedAt = now;
    this.state.note = note?.slice(0, 500) ?? null;
  }
}

function instantCredits(activity: RewardActivity): number {
  switch (activity) {
    case 'SURVEY': return RewardCredits.SURVEY;
    case 'FEEDBACK': return RewardCredits.FEEDBACK;
    case 'REFERRAL': return RewardCredits.REFERRAL;
    case 'REFERRED_SIGNUP': return RewardCredits.REFERRED_SIGNUP;
    default: return 0;
  }
}

const reviewedRange = (a: RewardActivity): [number, number] =>
  a === 'BUG_REPORT' ? [RewardCredits.BUG_REPORT_MIN, RewardCredits.BUG_REPORT_MAX] : [RewardCredits.USER_RESEARCH, RewardCredits.USER_RESEARCH];
const defaultReviewedCredits = (a: RewardActivity) => reviewedRange(a)[0];

/** Domain service: whether a user may do an activity again, given what they already did. */
export class RewardPolicy {
  static canSubmit(activity: RewardActivity, history: RewardClaimState[], now = new Date()): { allowed: boolean; reason: string } {
    const mine = history.filter((c) => c.activity === activity && c.status !== 'REJECTED');
    switch (activity) {
      case 'SURVEY':
        return mine.length ? { allowed: false, reason: 'Bạn đã làm khảo sát. Cảm ơn bạn!' } : { allowed: true, reason: '' };
      case 'FEEDBACK': {
        const last = mine.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
        const next = last ? last.createdAt.getTime() + FEEDBACK_COOLDOWN_DAYS * 86_400_000 : 0;
        return next > now.getTime()
          ? { allowed: false, reason: `Bạn có thể góp ý nhận thưởng tiếp từ ${new Date(next).toLocaleDateString('vi-VN')}.` }
          : { allowed: true, reason: '' };
      }
      case 'USER_RESEARCH':
        return mine.some((c) => c.status === 'PENDING')
          ? { allowed: false, reason: 'Chúng tôi đã nhận đăng ký và sẽ liên hệ bạn để hẹn lịch.' }
          : { allowed: true, reason: '' };
      case 'BUG_REPORT':
        return mine.filter((c) => c.status === 'PENDING').length >= 5
          ? { allowed: false, reason: 'Bạn có 5 báo lỗi đang chờ xử lý. Vui lòng đợi chúng tôi kiểm tra.' }
          : { allowed: true, reason: '' };
      case 'REFERRAL': {
        const monthAgo = now.getTime() - 30 * 86_400_000;
        const recent = mine.filter((c) => c.createdAt.getTime() > monthAgo).length;
        return recent >= MAX_REFERRALS_PER_MONTH
          ? { allowed: false, reason: `Thưởng giới thiệu tối đa ${MAX_REFERRALS_PER_MONTH} người mỗi tháng.` }
          : { allowed: true, reason: '' };
      }
      default:
        return { allowed: !mine.length, reason: '' };
    }
  }
}
