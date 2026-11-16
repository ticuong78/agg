import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { FREE_MONTHLY_CAP, TierCatalog, TOPUP_VALID_DAYS, WELCOME_CREDITS } from '@agg/contracts';
import { addDays } from '../../../shared/domain/aggregate-root.js';
import { USER_REGISTERED, type UserRegistered } from '../../identity/identity.events.js';
import { ORDER_PAID, type OrderPaid } from '../billing.events.js';
import { findPack } from '../domain/pricing.js';
import { SubscriptionRepository, WalletRepository, WorkspaceRepository } from '../domain/repositories.js';
import { Subscription } from '../domain/subscription.js';
import { Workspace } from '../domain/workspace.js';
import { AccountResolver, monthKey } from './account-resolver.js';
import { BillingIdentityPort } from './identity.port.js';

/** Reactions: welcome credits for new accounts, and what a paid order unlocks. */
@Injectable()
export class Fulfilment {
  private readonly logger = new Logger(Fulfilment.name);

  constructor(
    private readonly wallets: WalletRepository,
    private readonly subscriptions: SubscriptionRepository,
    private readonly workspaces: WorkspaceRepository,
    private readonly accounts: AccountResolver,
    private readonly identity: BillingIdentityPort,
  ) {}

  @OnEvent(USER_REGISTERED, { async: true, promisify: true })
  async welcome(event: UserRegistered): Promise<void> {
    const now = new Date();
    await this.wallets.transact('USER', event.userId, (wallet) => {
      wallet.grant('WELCOME', WELCOME_CREDITS, null, 'welcome', 'Quà chào mừng', now);
      // The welcome gift covers the first month: the monthly refill starts next month.
      wallet.refill('MONTHLY_FREE', FREE_MONTHLY_CAP, 0, `free:${monthKey(now)}`, now, 'Credit miễn phí hằng tháng', now);
    });
  }

  @OnEvent(ORDER_PAID, { async: true, promisify: true })
  async fulfil(event: OrderPaid): Promise<void> {
    const { product } = event;
    if (product.kind === 'TOPUP') {
      const pack = findPack(product.packId);
      await this.wallets.transact('USER', event.buyerUserId, (wallet) =>
        wallet.grant('TOPUP', pack.credits, addDays(new Date(), TOPUP_VALID_DAYS), `order:${event.orderId}`, `Mua gói ${pack.label}`));
      return;
    }

    const extraSeats = product.extraSeats ?? 0;
    if (product.tier === 'SCHOOL') {
      let workspace = await this.workspaces.findByOwner(event.buyerUserId);
      if (!workspace) {
        const buyer = await this.identity.find(event.buyerUserId);
        if (!buyer) throw new Error(`Buyer ${event.buyerUserId} not found`);
        workspace = Workspace.create(event.workspaceName ?? 'Tổ chuyên môn', { userId: buyer.id, email: buyer.email });
        await this.workspaces.save(workspace);
      }
      await this.extend('WORKSPACE', workspace.id, product.tier, product.period, extraSeats);
    } else {
      await this.extend('USER', event.buyerUserId, product.tier, product.period, 0);
    }
    this.logger.log(`Plan ${TierCatalog[product.tier].name} (${product.period}) applied for order ${event.orderId}`);
  }

  private async extend(kind: 'USER' | 'WORKSPACE', ownerId: string, tier: 'INDIVIDUAL' | 'SCHOOL', period: 'MONTH' | 'YEAR', extraSeats: number) {
    const existing = await this.subscriptions.findByOwner(kind, ownerId);
    const subscription = existing ?? Subscription.start(kind, ownerId, tier, period, extraSeats);
    if (existing) existing.renew(tier, period, extraSeats);
    await this.subscriptions.save(subscription);
    // Grants the first month right away.
    const due = subscription.dueGrants();
    if (due.length) {
      await this.wallets.transact(kind, ownerId, (wallet) => {
        for (const g of due) wallet.grant('PLAN', g.credits, g.expiresAt, g.reference, `Credit gói ${TierCatalog[tier].name} hằng tháng`);
      });
      await this.subscriptions.save(subscription);
    }
  }
}
