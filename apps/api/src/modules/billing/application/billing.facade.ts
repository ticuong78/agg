import { Injectable } from '@nestjs/common';
import { CreditActionLabels, CreditCosts, TierCatalog, type CreditAction, type Features, type Limits, type Tier } from '@agg/contracts';
import type { Requester } from '../../../shared/application/requester.js';
import { DomainError } from '../../../shared/domain/domain-error.js';
import { DailyUsageRepository, WalletRepository } from '../domain/repositories.js';
import { AccountResolver } from './account-resolver.js';

export interface UsageProfile {
  tier: Tier;
  limits: Limits;
  features: Features;
}

/** What other contexts may ask Billing: limits, the daily allowance, credits. */
@Injectable()
export class BillingFacade {
  constructor(
    private readonly accounts: AccountResolver,
    private readonly wallets: WalletRepository,
    private readonly daily: DailyUsageRepository,
  ) {}

  async profile(requester: Requester): Promise<UsageProfile> {
    const { tier } = await this.accounts.resolve(requester);
    const definition = TierCatalog[tier];
    return { tier, limits: definition.limits, features: definition.features };
  }

  /**
   * Guests are counted per browser and per network (a shared school network gets more room than one browser);
   * free accounts per account. Paid tiers have no daily cap.
   */
  async consumeConversion(requester: Requester, profile: UsageProfile): Promise<void> {
    const limit = profile.limits.dailyConversions;
    if (limit === null) return;
    const counters = requester.kind === 'user'
      ? [{ key: `u:${requester.userId}`, limit }]
      : [
          ...(requester.visitorId ? [{ key: `v:${requester.visitorId}`, limit }] : []),
          { key: `ip:${requester.ipHash}`, limit: limit * (requester.visitorId ? 10 : 1) },
        ];
    const counted = await this.daily.incrementIfBelow(counters, today());
    if (!counted) {
      throw DomainError.paymentRequired('limit.daily_conversions',
        requester.kind === 'guest'
          ? `Bạn đã dùng hết ${limit} lượt miễn phí hôm nay. Đăng nhập (miễn phí) để có thêm lượt và dùng AI.`
          : `Tài khoản miễn phí dùng tối đa ${limit} lượt mỗi ngày. Nâng cấp gói để không giới hạn.`,
        { action: requester.kind === 'guest' ? 'signin' : 'upgrade' });
    }
  }

  async conversionsToday(requester: Requester): Promise<number> {
    const key = requester.kind === 'user' ? `u:${requester.userId}` : requester.visitorId ? `v:${requester.visitorId}` : `ip:${requester.ipHash}`;
    return this.daily.count(key, today());
  }

  async balance(requester: Requester): Promise<number> {
    const { wallet } = await this.accounts.resolve(requester);
    if (!wallet) return 0;
    return (await this.wallets.find(wallet.kind, wallet.id))?.balance() ?? 0;
  }

  async assertCanAfford(requester: Requester, action: CreditAction, units: number): Promise<void> {
    const needed = CreditCosts[action] * units;
    if (needed === 0) return;
    const balance = await this.balance(requester);
    if (balance < needed) {
      throw DomainError.paymentRequired('credits.insufficient',
        `${CreditActionLabels[action]} cần ${needed} credit, bạn còn ${balance}. Hãy mua thêm credit hoặc nâng cấp gói.`,
        { action: requester.kind === 'guest' ? 'signin' : 'upgrade', needed: String(needed), balance: String(balance) });
    }
  }

  async charge(requester: Requester, action: CreditAction, units: number, reference: string): Promise<number> {
    const amount = CreditCosts[action] * units;
    const { wallet } = await this.accounts.resolve(requester);
    if (!wallet || requester.kind !== 'user') throw DomainError.unauthorized('auth.required', 'Vui lòng đăng nhập.');
    if (amount === 0) return this.balance(requester);
    return this.wallets.transact(wallet.kind, wallet.id, (w) =>
      w.spend(amount, requester.userId, `${CreditActionLabels[action]}${units > 1 ? ` × ${units}` : ''}`, reference));
  }

  /** Rewards (growth): credits on the account's own wallet. Idempotent on `reference`. */
  async grantReward(userId: string, credits: number, reference: string, reason: string): Promise<boolean> {
    return this.wallets.transact('USER', userId, (w) => w.grant('REWARD', credits, null, reference, reason));
  }
}

/** Calendar day in Vietnam (UTC+7), when "today's" allowance resets. */
export function today(now = new Date()): string {
  return new Date(now.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
}
