import { Injectable } from '@nestjs/common';
import { FREE_MONTHLY_CAP, TierCatalog, type Tier } from '@agg/contracts';
import type { Requester, UserRequester } from '../../../shared/application/requester.js';
import { addDays } from '../../../shared/domain/aggregate-root.js';
import { SubscriptionRepository, WalletRepository, WorkspaceRepository } from '../domain/repositories.js';
import type { Subscription } from '../domain/subscription.js';
import type { OwnerKind } from '../domain/wallet.js';
import type { Workspace } from '../domain/workspace.js';

export interface ResolvedAccount {
  tier: Tier;
  /** Whose wallet pays: the workspace pool for members of a team plan, otherwise the account itself. */
  wallet: { kind: OwnerKind; id: string } | null;
  subscription: Subscription | null;
  workspace: Workspace | null;
}

const FREE_CREDIT_LIFETIME_DAYS = 60;
export const monthKey = (now: Date) => `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

/**
 * Decides which tier applies and which wallet pays. A member of a workspace with an active team plan spends the
 * shared pool; otherwise the account's own plan (or FREE) applies. Due monthly credits are granted on the way,
 * so no scheduler has to run for balances to be right.
 */
@Injectable()
export class AccountResolver {
  constructor(
    private readonly wallets: WalletRepository,
    private readonly subscriptions: SubscriptionRepository,
    private readonly workspaces: WorkspaceRepository,
  ) {}

  async resolve(requester: Requester): Promise<ResolvedAccount> {
    if (requester.kind === 'guest') return { tier: 'GUEST', wallet: null, subscription: null, workspace: null };
    const now = new Date();

    const workspace = await this.workspaceOf(requester);
    if (workspace) {
      const teamPlan = await this.subscriptions.findByOwner('WORKSPACE', workspace.id);
      if (teamPlan?.isActive(now)) {
        await this.grantDue(teamPlan, now);
        return { tier: teamPlan.tier, wallet: { kind: 'WORKSPACE', id: workspace.id }, subscription: teamPlan, workspace };
      }
    }

    const own = await this.subscriptions.findByOwner('USER', requester.userId);
    if (own?.isActive(now)) {
      await this.grantDue(own, now);
      return { tier: own.tier, wallet: { kind: 'USER', id: requester.userId }, subscription: own, workspace };
    }

    await this.wallets.transact('USER', requester.userId, (wallet) =>
      wallet.refill('MONTHLY_FREE', FREE_MONTHLY_CAP, TierCatalog.FREE.monthlyCredits, `free:${monthKey(now)}`,
        addDays(now, FREE_CREDIT_LIFETIME_DAYS), 'Credit miễn phí hằng tháng', now));
    return { tier: 'FREE', wallet: { kind: 'USER', id: requester.userId }, subscription: null, workspace };
  }

  /** The workspace listing the account; an invited address joins on its first request after signing in. */
  async workspaceOf(requester: UserRequester): Promise<Workspace | null> {
    const workspace = await this.workspaces.findByMember(requester.userId, requester.email);
    if (workspace?.join(requester.userId, requester.email)) await this.workspaces.save(workspace);
    return workspace;
  }

  private async grantDue(subscription: Subscription, now: Date): Promise<void> {
    const due = subscription.dueGrants(now);
    if (!due.length) return;
    const name = TierCatalog[subscription.tier].name;
    await this.wallets.transact(subscription.ownerKind, subscription.ownerId, (wallet) => {
      for (const grant of due) wallet.grant('PLAN', grant.credits, grant.expiresAt, grant.reference, `Credit gói ${name} hằng tháng`, now);
    });
    await this.subscriptions.save(subscription);
  }
}
