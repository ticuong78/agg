import type { CheckoutProduct } from '@agg/contracts';
import type { DomainEvent } from '../../shared/domain/aggregate-root.js';

export const ORDER_PAID = 'billing.order_paid';

export class OrderPaid implements DomainEvent {
  readonly name = ORDER_PAID;
  readonly occurredAt = new Date();
  constructor(
    readonly orderId: string,
    readonly buyerUserId: string,
    readonly product: CheckoutProduct,
    readonly workspaceName: string | null,
  ) {}
}
