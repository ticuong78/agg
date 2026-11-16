import { Injectable } from '@nestjs/common';
import { CreditCosts, TierCatalog, type LedgerEntryDto, type PaidTier, type UsageDto } from '@agg/contracts';
import type { Requester, UserRequester } from '../../../shared/application/requester.js';
import { WalletRepository } from '../domain/repositories.js';
import { AccountResolver } from './account-resolver.js';
import { BillingFacade } from './billing.facade.js';

@Injectable()
export class UsageService {
  constructor(
    private readonly accounts: AccountResolver,
    private readonly wallets: WalletRepository,
    private readonly billing: BillingFacade,
  ) {}

  async usage(requester: Requester): Promise<UsageDto> {
    const account = await this.accounts.resolve(requester);
    const definition = TierCatalog[account.tier];
    const wallet = account.wallet ? await this.wallets.find(account.wallet.kind, account.wallet.id) : null;
    const dailyLimit = definition.limits.dailyConversions;
    const usedToday = dailyLimit !== null ? await this.billing.conversionsToday(requester) : 0;
    const role = account.workspace && requester.kind === 'user' ? account.workspace.roleOf(requester.userId) : null;
    return {
      tier: account.tier,
      tierName: definition.name,
      credits: wallet?.balance() ?? 0,
      buckets: (wallet?.live() ?? []).map((b) => ({ source: b.source, remaining: b.remaining, expiresAt: b.expiresAt?.toISOString() ?? null })),
      limits: definition.limits,
      features: definition.features,
      costs: CreditCosts,
      guest: dailyLimit !== null ? { usedToday, dailyLimit } : null,
      plan: account.subscription
        ? { tier: account.subscription.tier as PaidTier, period: account.subscription.period, endsAt: account.subscription.endsAt.toISOString() }
        : null,
      workspace: account.workspace && role ? { id: account.workspace.id, name: account.workspace.name, role } : null,
    };
  }

  async ledger(requester: UserRequester): Promise<LedgerEntryDto[]> {
    const { wallet } = await this.accounts.resolve(requester);
    if (!wallet) return [];
    const found = await this.wallets.find(wallet.kind, wallet.id);
    if (!found) return [];
    const lines = await this.wallets.ledger(found.id, 100);
    // In a shared pool, members see their own spending and the pool's grants, not each other's activity.
    return lines
      .filter((l) => wallet.kind === 'USER' || l.amount > 0 || l.userId === requester.userId)
      .map((l) => ({ id: l.id, at: l.at.toISOString(), amount: l.amount, reason: l.reason, reference: l.reference }));
  }
}
