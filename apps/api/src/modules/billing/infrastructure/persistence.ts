import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import type { CheckoutProduct, OrderStatus, PaidTier, PaymentProvider } from '@agg/contracts';
import {
  Column, DataSource, Entity, Index, LessThanOrEqual, MoreThanOrEqual, PrimaryColumn, QueryFailedError, type EntityManager, type Repository,
} from 'typeorm';
import { Order } from '../domain/order.js';
import {
  DailyUsageRepository, OrderRepository, SubscriptionRepository, WalletRepository, WorkspaceRepository,
} from '../domain/repositories.js';
import { Subscription } from '../domain/subscription.js';
import { Wallet, type CreditBucket, type LedgerLine, type OwnerKind } from '../domain/wallet.js';
import { Workspace, type WorkspaceMember } from '../domain/workspace.js';

@Entity('wallets')
@Index(['ownerKind', 'ownerId'], { unique: true })
export class WalletOrmEntity {
  @PrimaryColumn('uuid') id: string;
  @Column({ name: 'owner_kind', type: 'varchar', length: 10 }) ownerKind: OwnerKind;
  @Column({ name: 'owner_id', type: 'uuid' }) ownerId: string;
  @Column({ type: 'jsonb' }) buckets: CreditBucket[];
}

@Entity('ledger_entries')
@Index(['walletId', 'at'])
export class LedgerOrmEntity {
  @PrimaryColumn('uuid') id: string;
  @Column({ name: 'wallet_id', type: 'uuid' }) walletId: string;
  @Column({ name: 'user_id', type: 'uuid', nullable: true }) userId: string | null;
  @Column({ type: 'int' }) amount: number;
  @Column({ type: 'varchar', length: 200 }) reason: string;
  @Column({ type: 'varchar', length: 200, nullable: true }) reference: string | null;
  @Column({ type: 'timestamptz' }) at: Date;
}

@Entity('subscriptions')
@Index(['ownerKind', 'ownerId'], { unique: true })
export class SubscriptionOrmEntity {
  @PrimaryColumn('uuid') id: string;
  @Column({ name: 'owner_kind', type: 'varchar', length: 10 }) ownerKind: OwnerKind;
  @Column({ name: 'owner_id', type: 'uuid' }) ownerId: string;
  @Column({ type: 'varchar', length: 12 }) tier: PaidTier;
  @Column({ type: 'varchar', length: 6 }) period: 'MONTH' | 'YEAR';
  @Column({ name: 'extra_seats', type: 'int', default: 0 }) extraSeats: number;
  @Column({ name: 'starts_at', type: 'timestamptz' }) startsAt: Date;
  @Column({ name: 'ends_at', type: 'timestamptz' }) endsAt: Date;
  @Index() @Column({ name: 'next_grant_at', type: 'timestamptz' }) nextGrantAt: Date;
  @Column({ name: 'grants_made', type: 'int', default: 0 }) grantsMade: number;
}

@Entity('orders')
export class OrderOrmEntity {
  @PrimaryColumn('uuid') id: string;
  @Index({ unique: true }) @Column({ type: 'varchar', length: 16 }) code: string;
  @Index() @Column({ name: 'buyer_user_id', type: 'uuid' }) buyerUserId: string;
  @Column({ type: 'jsonb' }) product: CheckoutProduct;
  @Column({ type: 'varchar', length: 200 }) description: string;
  @Column({ type: 'int' }) amount: number;
  @Column({ type: 'varchar', length: 10 }) provider: PaymentProvider;
  @Index() @Column({ type: 'varchar', length: 10 }) status: OrderStatus;
  @Column({ name: 'provider_ref', type: 'varchar', length: 200, nullable: true }) providerRef: string | null;
  @Column({ name: 'workspace_name', type: 'varchar', length: 120, nullable: true }) workspaceName: string | null;
  @Column({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true }) paidAt: Date | null;
  @Column({ name: 'expires_at', type: 'timestamptz' }) expiresAt: Date;
}

@Entity('workspaces')
export class WorkspaceOrmEntity {
  @PrimaryColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 120 }) name: string;
  @Index({ unique: true }) @Column({ name: 'owner_user_id', type: 'uuid' }) ownerUserId: string;
  @Column({ type: 'varchar', length: 200, default: '' }) header: string;
  @Column({ type: 'jsonb' }) members: WorkspaceMember[];
  /** Denormalised for membership lookups: lower-case e-mails of every member. */
  @Index() @Column({ name: 'member_emails', type: 'text', array: true }) memberEmails: string[];
}

@Entity('daily_usage')
export class DailyUsageOrmEntity {
  @PrimaryColumn({ type: 'varchar', length: 80 }) key: string;
  @PrimaryColumn({ type: 'varchar', length: 10 }) day: string;
  @Column({ type: 'int', default: 0 }) count: number;
}

@Injectable()
export class TypeOrmWalletRepository extends WalletRepository {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    @InjectRepository(WalletOrmEntity) private readonly repo: Repository<WalletOrmEntity>,
    @InjectRepository(LedgerOrmEntity) private readonly lines: Repository<LedgerOrmEntity>,
  ) {
    super();
  }

  async find(ownerKind: OwnerKind, ownerId: string) {
    const row = await this.repo.findOneBy({ ownerKind, ownerId });
    return row ? Wallet.restore(row) : null;
  }

  async transact<T>(ownerKind: OwnerKind, ownerId: string, work: (wallet: Wallet) => T | Promise<T>): Promise<T> {
    try {
      return await this.run(ownerKind, ownerId, work);
    } catch (error) {
      // Two first requests of a new account may both try to create its wallet: the loser retries on the winner's row.
      if (error instanceof QueryFailedError && /duplicate key/i.test(error.message)) return this.run(ownerKind, ownerId, work);
      throw error;
    }
  }

  private run<T>(ownerKind: OwnerKind, ownerId: string, work: (wallet: Wallet) => T | Promise<T>): Promise<T> {
    return this.db.transaction(async (manager: EntityManager) => {
      const row = await manager.getRepository(WalletOrmEntity).findOne({ where: { ownerKind, ownerId }, lock: { mode: 'pessimistic_write' } });
      const wallet = row ? Wallet.restore(row) : Wallet.open(ownerKind, ownerId);
      const result = await work(wallet);
      await manager.getRepository(WalletOrmEntity).save(wallet.snapshot());
      const lines = wallet.pullLines();
      if (lines.length) await manager.getRepository(LedgerOrmEntity).insert(lines);
      return result;
    });
  }

  async deleteOwner(ownerKind: OwnerKind, ownerId: string) {
    const row = await this.repo.findOneBy({ ownerKind, ownerId });
    if (!row) return;
    await this.lines.delete({ walletId: row.id });
    await this.repo.delete({ id: row.id });
  }

  async ledger(walletId: string, limit: number): Promise<LedgerLine[]> {
    return this.lines.find({ where: { walletId }, order: { at: 'DESC' }, take: limit });
  }

  async spentByUser(walletId: string, since: Date): Promise<Map<string, number>> {
    const rows: { user_id: string; spent: string }[] = await this.lines
      .createQueryBuilder('l')
      .select('l.user_id', 'user_id')
      .addSelect('SUM(-l.amount)', 'spent')
      .where('l.wallet_id = :walletId AND l.amount < 0 AND l.at >= :since AND l.user_id IS NOT NULL', { walletId, since })
      .groupBy('l.user_id')
      .getRawMany();
    return new Map(rows.map((r) => [r.user_id, Number(r.spent)]));
  }
}

@Injectable()
export class TypeOrmSubscriptionRepository extends SubscriptionRepository {
  constructor(@InjectRepository(SubscriptionOrmEntity) private readonly repo: Repository<SubscriptionOrmEntity>) {
    super();
  }

  async findByOwner(ownerKind: OwnerKind, ownerId: string) {
    const row = await this.repo.findOneBy({ ownerKind, ownerId });
    return row ? Subscription.restore(row) : null;
  }
  async deleteOwner(ownerKind: OwnerKind, ownerId: string) {
    await this.repo.delete({ ownerKind, ownerId });
  }
  async listDue(now: Date) {
    return (await this.repo.findBy({ nextGrantAt: LessThanOrEqual(now), endsAt: MoreThanOrEqual(now) })).map((r) => Subscription.restore(r));
  }
  async save(subscription: Subscription) {
    await this.repo.save(subscription.snapshot());
  }
}

@Injectable()
export class TypeOrmOrderRepository extends OrderRepository {
  constructor(@InjectRepository(OrderOrmEntity) private readonly repo: Repository<OrderOrmEntity>) {
    super();
  }

  async findById(id: string) {
    const row = await this.repo.findOneBy({ id });
    return row ? Order.restore(row) : null;
  }
  async findByCode(code: string) {
    const row = await this.repo.findOneBy({ code });
    return row ? Order.restore(row) : null;
  }
  async listByBuyer(buyerUserId: string, limit: number) {
    return (await this.repo.find({ where: { buyerUserId }, order: { createdAt: 'DESC' }, take: limit })).map((r) => Order.restore(r));
  }
  async listPendingOlderThan(date: Date) {
    return (await this.repo.findBy({ status: 'PENDING', expiresAt: LessThanOrEqual(date) })).map((r) => Order.restore(r));
  }
  async save(order: Order) {
    await this.repo.save(order.snapshot());
  }
}

@Injectable()
export class TypeOrmWorkspaceRepository extends WorkspaceRepository {
  constructor(@InjectRepository(WorkspaceOrmEntity) private readonly repo: Repository<WorkspaceOrmEntity>) {
    super();
  }

  async findById(id: string) {
    const row = await this.repo.findOneBy({ id });
    return row ? Workspace.restore(row) : null;
  }
  async findByOwner(ownerUserId: string) {
    const row = await this.repo.findOneBy({ ownerUserId });
    return row ? Workspace.restore(row) : null;
  }
  async findByMember(userId: string, email: string) {
    const row = await this.repo
      .createQueryBuilder('w')
      .where(':email = ANY(w.member_emails)', { email: email.toLowerCase() })
      .orWhere('w.owner_user_id = :userId', { userId })
      .getOne();
    return row ? Workspace.restore(row) : null;
  }
  async delete(id: string) {
    await this.repo.delete({ id });
  }
  async save(workspace: Workspace) {
    const state = workspace.snapshot();
    await this.repo.save({ ...state, memberEmails: state.members.map((m) => m.email) });
  }
}

@Injectable()
export class TypeOrmDailyUsageRepository extends DailyUsageRepository {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    @InjectRepository(DailyUsageOrmEntity) private readonly repo: Repository<DailyUsageOrmEntity>,
  ) {
    super();
  }

  async incrementIfBelow(counters: { key: string; limit: number }[], day: string): Promise<boolean> {
    return this.db.transaction(async (manager) => {
      for (const { key } of counters) {
        await manager.query('INSERT INTO daily_usage (key, day, count) VALUES ($1, $2, 0) ON CONFLICT DO NOTHING', [key, day]);
      }
      const rows: { key: string; count: number }[] = await manager.query(
        'SELECT key, count FROM daily_usage WHERE day = $1 AND key = ANY($2) FOR UPDATE', [day, counters.map((c) => c.key)]);
      const full = counters.some((c) => (rows.find((r) => r.key === c.key)?.count ?? 0) >= c.limit);
      if (full) return false;
      await manager.query('UPDATE daily_usage SET count = count + 1 WHERE day = $1 AND key = ANY($2)', [day, counters.map((c) => c.key)]);
      return true;
    });
  }

  async count(key: string, day: string) {
    return (await this.repo.findOneBy({ key, day }))?.count ?? 0;
  }

  async deleteBefore(day: string) {
    // YYYY-MM-DD strings sort as dates, so one comparison finds every older day.
    const result = await this.repo.createQueryBuilder().delete().where('day < :day', { day }).execute();
    return result.affected ?? 0;
  }
}
