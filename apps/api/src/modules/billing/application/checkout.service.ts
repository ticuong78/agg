import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  PaymentProviderLabels, PaymentProviders, type CheckoutRequest, type CheckoutResponse, type OrderDto, type PaymentMethodDto, type PaymentProvider,
} from '@agg/contracts';
import { EventPublisher } from '../../../shared/application/event-publisher.js';
import { RateLimiter } from '../../../shared/application/rate-limiter.js';
import { enforceRateLimit } from '../../../shared/application/rate-limit.js';
import type { UserRequester } from '../../../shared/application/requester.js';
import { DomainError } from '../../../shared/domain/domain-error.js';
import { Order } from '../domain/order.js';
import { price } from '../domain/pricing.js';
import { OrderRepository } from '../domain/repositories.js';
import { PaymentGateways, type IncomingNotification } from './ports.js';

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);
  private readonly frontendUrl: string;
  private readonly publicApiUrl: string;

  constructor(
    private readonly orders: OrderRepository,
    private readonly gateways: PaymentGateways,
    private readonly events: EventPublisher,
    private readonly limiter: RateLimiter,
    config: ConfigService,
  ) {
    this.frontendUrl = (config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000').replace(/\/$/, '');
    this.publicApiUrl = (config.get<string>('PUBLIC_API_URL') ?? 'http://localhost:4000').replace(/\/$/, '');
  }

  methods(): PaymentMethodDto[] {
    return PaymentProviders.map((provider) => ({ provider, label: PaymentProviderLabels[provider], available: this.gateways.get(provider).available }));
  }

  async checkout(requester: UserRequester, body: CheckoutRequest, clientIp: string): Promise<CheckoutResponse> {
    await enforceRateLimit(this.limiter, `checkout:${requester.userId}`, 20, 3600);
    const gateway = this.gateways.get(body.provider);
    if (!gateway.available) throw DomainError.validation('checkout.provider_unavailable', `${PaymentProviderLabels[body.provider]} chưa được bật. Hãy chọn cách thanh toán khác.`);
    const priced = price(body.product);
    const workspaceName = body.product.kind === 'PLAN' && body.product.tier === 'SCHOOL' ? (body.workspaceName?.trim() || null) : null;
    const order = Order.place(requester.userId, priced, body.provider, workspaceName);
    await this.orders.save(order);
    const start = await gateway.start(order, {
      returnUrl: `${this.frontendUrl}/checkout/result?order=${order.id}`,
      notifyUrl: `${this.publicApiUrl}/api/billing/webhooks/${body.provider.toLowerCase()}`,
      clientIp,
      buyerEmail: requester.email,
    });
    return { orderId: order.id, ...start };
  }

  async order(requester: UserRequester, id: string): Promise<OrderDto> {
    const order = await this.orders.findById(id);
    if (!order || order.buyerUserId !== requester.userId) throw DomainError.notFound('order.not_found', 'Không tìm thấy đơn hàng.');
    return toOrderDto(order);
  }

  async listOrders(requester: UserRequester): Promise<OrderDto[]> {
    return (await this.orders.listByBuyer(requester.userId, 50)).map(toOrderDto);
  }

  /** A provider notification: verified by the gateway, then applied once per order. */
  async notify(provider: PaymentProvider, notification: IncomingNotification): Promise<{ status: number; body: unknown }> {
    const gateway = this.gateways.get(provider);
    try {
      const results = await gateway.verify(notification);
      for (const result of results ?? []) {
        const order = await this.orders.findByCode(result.orderCode);
        if (!order || order.provider !== provider) {
          this.logger.warn(`${provider} notification for unknown order ${result.orderCode}`);
          continue;
        }
        if (result.paid) {
          if (order.markPaid(result.amount, result.providerRef)) this.logger.log(`Order ${order.code} paid via ${provider}`);
        } else {
          order.markFailed(result.providerRef);
        }
        await this.orders.save(order);
        await this.events.publish(order.pullEvents());
      }
      return gateway.acknowledge(true);
    } catch (error) {
      this.logger.warn(`${provider} notification refused: ${(error as Error).message}`);
      return gateway.acknowledge(false);
    }
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async expireStale(): Promise<void> {
    const now = new Date();
    for (const order of await this.orders.listPendingOlderThan(now)) {
      if (order.expireIfDue(now)) await this.orders.save(order);
    }
  }
}

export function toOrderDto(order: Order): OrderDto {
  const s = order.snapshot();
  return {
    id: s.id, code: s.code, description: s.description, amount: s.amount, provider: s.provider, status: s.status,
    createdAt: s.createdAt.toISOString(), paidAt: s.paidAt?.toISOString() ?? null,
  };
}
