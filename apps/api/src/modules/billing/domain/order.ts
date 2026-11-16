import type { CheckoutProduct, OrderStatus, PaymentProvider } from '@agg/contracts';
import { randomInt } from 'node:crypto';
import { AggregateRoot, newId } from '../../../shared/domain/aggregate-root.js';
import { DomainError } from '../../../shared/domain/domain-error.js';
import { OrderPaid } from '../billing.events.js';
import type { PricedProduct } from './pricing.js';

export const ORDER_TTL_MINUTES = 60 * 24;

export interface OrderState {
  id: string;
  /** Short reference customers see and type in a bank transfer: GD + 8 digits. */
  code: string;
  buyerUserId: string;
  product: CheckoutProduct;
  description: string;
  amount: number;
  provider: PaymentProvider;
  status: OrderStatus;
  providerRef: string | null;
  workspaceName: string | null;
  createdAt: Date;
  paidAt: Date | null;
  expiresAt: Date;
}

/** Aggregate: one purchase. Paid exactly once, for exactly its amount; whatever the provider sends twice is ignored. */
export class Order extends AggregateRoot {
  private constructor(private state: OrderState) {
    super(state.id);
  }

  static place(buyerUserId: string, priced: PricedProduct, provider: PaymentProvider, workspaceName: string | null, now = new Date()): Order {
    return new Order({
      id: newId(),
      code: `GD${String(randomInt(0, 100_000_000)).padStart(8, '0')}`,
      buyerUserId,
      product: priced.product,
      description: priced.description,
      amount: priced.amount,
      provider,
      status: 'PENDING',
      providerRef: null,
      workspaceName,
      createdAt: now,
      paidAt: null,
      expiresAt: new Date(now.getTime() + ORDER_TTL_MINUTES * 60_000),
    });
  }

  static restore(state: OrderState): Order {
    return new Order({ ...state });
  }

  get code(): string { return this.state.code; }
  get amount(): number { return this.state.amount; }
  get status(): OrderStatus { return this.state.status; }
  get provider(): PaymentProvider { return this.state.provider; }
  get buyerUserId(): string { return this.state.buyerUserId; }
  get description(): string { return this.state.description; }
  snapshot(): OrderState { return { ...this.state }; }

  /** Returns false when it was already paid (a repeated notification). */
  markPaid(paidAmount: number, providerRef: string, now = new Date()): boolean {
    if (this.state.status === 'PAID') return false;
    if (paidAmount !== this.state.amount) {
      throw DomainError.validation('order.amount_mismatch', `Order ${this.state.code}: paid ${paidAmount}, expected ${this.state.amount}`);
    }
    // A late payment of an expired order is still the customer's money: honour it.
    this.state.status = 'PAID';
    this.state.paidAt = now;
    this.state.providerRef = providerRef;
    this.record(new OrderPaid(this.state.id, this.state.buyerUserId, this.state.product, this.state.workspaceName));
    return true;
  }

  markFailed(providerRef: string | null): void {
    if (this.state.status !== 'PENDING') return;
    this.state.status = 'FAILED';
    this.state.providerRef = providerRef;
  }

  expireIfDue(now = new Date()): boolean {
    if (this.state.status !== 'PENDING' || this.state.expiresAt > now) return false;
    this.state.status = 'EXPIRED';
    return true;
  }
}
