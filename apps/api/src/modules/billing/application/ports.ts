import type { BankTransferDto, PaymentProvider } from '@agg/contracts';
import type { Order } from '../domain/order.js';

export interface PaymentStart {
  redirectUrl: string | null;
  bankTransfer: BankTransferDto | null;
}

export interface PaymentContext {
  /** Where the provider sends the customer back (frontend). */
  returnUrl: string;
  /** Where the provider notifies the API. */
  notifyUrl: string;
  clientIp: string;
  buyerEmail: string;
}

/** Raw notification as received over HTTP; each gateway checks its own signature. */
export interface IncomingNotification {
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, unknown>;
  body: unknown;
  rawBody: Buffer | undefined;
}

export interface PaymentResult {
  orderCode: string;
  paid: boolean;
  amount: number;
  providerRef: string;
}

/** Port: one payment provider. */
export abstract class PaymentGateway {
  abstract readonly provider: PaymentProvider;
  abstract get available(): boolean;
  abstract start(order: Order, context: PaymentContext): Promise<PaymentStart>;
  /**
   * Verifies a notification (IPN / webhook) and reads it. Returns null for notifications that are not about a payment.
   * Throws when the signature is wrong.
   */
  abstract verify(notification: IncomingNotification): Promise<PaymentResult[] | null>;
  /** What the provider expects as the answer body once the notification was handled. */
  acknowledge(ok: boolean): { status: number; body: unknown } {
    return { status: ok ? 200 : 400, body: { ok } };
  }
}

export abstract class PaymentGateways {
  abstract get(provider: PaymentProvider): PaymentGateway;
  abstract all(): PaymentGateway[];
}
