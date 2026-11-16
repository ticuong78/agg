import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PaymentGateway, type IncomingNotification, type PaymentContext, type PaymentResult } from '../../application/ports.js';
import type { Order } from '../../domain/order.js';

/** International cards through Stripe Checkout. VND is a zero-decimal currency: amounts are sent as they are. */
@Injectable()
export class StripeGateway extends PaymentGateway {
  readonly provider = 'STRIPE' as const;
  private readonly stripe: Stripe | null;
  private readonly webhookSecret: string;

  constructor(config: ConfigService) {
    super();
    const key = config.get<string>('STRIPE_SECRET_KEY');
    this.stripe = key ? new Stripe(key) : null;
    this.webhookSecret = config.get<string>('STRIPE_WEBHOOK_SECRET') ?? '';
  }

  get available(): boolean {
    return Boolean(this.stripe && this.webhookSecret);
  }

  async start(order: Order, context: PaymentContext) {
    const session = await this.stripe!.checkout.sessions.create({
      mode: 'payment',
      customer_email: context.buyerEmail,
      client_reference_id: order.code,
      metadata: { order_code: order.code },
      line_items: [{ quantity: 1, price_data: { currency: 'vnd', unit_amount: order.amount, product_data: { name: order.description } } }],
      success_url: context.returnUrl,
      cancel_url: `${context.returnUrl}&cancelled=1`,
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
    });
    if (!session.url) throw new Error('Stripe returned no checkout URL');
    return { redirectUrl: session.url, bankTransfer: null };
  }

  async verify({ headers, rawBody }: IncomingNotification): Promise<PaymentResult[] | null> {
    const signature = headers['stripe-signature'];
    if (!rawBody || typeof signature !== 'string') throw new Error('Missing Stripe signature or body');
    const event = this.stripe!.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
    if (event.type !== 'checkout.session.completed' && event.type !== 'checkout.session.async_payment_succeeded') return null;
    const session = event.data.object as Stripe.Checkout.Session;
    const code = session.metadata?.order_code ?? session.client_reference_id;
    if (!code) return null;
    return [{ orderCode: code, paid: session.payment_status === 'paid', amount: session.amount_total ?? 0, providerRef: session.id }];
  }
}
