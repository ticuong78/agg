import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ACCOUNT_DELETED, type AccountDeleted } from '../../identity/identity.events.js';
import { SubscriptionRepository, WalletRepository, WorkspaceRepository } from '../domain/repositories.js';

/**
 * A deleted account loses its credits, plan and workspace. Orders are kept: accounting law requires payment records
 * (they hold the account id and amounts, no profile data).
 */
@Injectable()
export class BillingErasure {
  constructor(
    private readonly wallets: WalletRepository,
    private readonly subscriptions: SubscriptionRepository,
    private readonly workspaces: WorkspaceRepository,
  ) {}

  @OnEvent(ACCOUNT_DELETED, { async: true, promisify: true })
  async erase(event: AccountDeleted): Promise<void> {
    await this.wallets.deleteOwner('USER', event.userId);
    await this.subscriptions.deleteOwner('USER', event.userId);
    const owned = await this.workspaces.findByOwner(event.userId);
    if (owned) {
      await this.wallets.deleteOwner('WORKSPACE', owned.id);
      await this.subscriptions.deleteOwner('WORKSPACE', owned.id);
      await this.workspaces.delete(owned.id);
    }
    const member = await this.workspaces.findByMember(event.userId, event.email);
    if (member && !member.isOwner(event.userId)) {
      member.remove(event.email);
      await this.workspaces.save(member);
    }
  }
}
