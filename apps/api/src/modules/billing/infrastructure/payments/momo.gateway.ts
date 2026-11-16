import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { PaymentGateway, type IncomingNotification, type PaymentContext, type PaymentResult } from '../../application/ports.js';
import type { Order } from '../../domain/order.js';

const sign = (raw: string, secret: string) => createHmac('sha256', secret).update(raw).digest('hex');

/** MoMo wallet (API v2, captureWallet): create a payment, redirect to payUrl, confirmation by IPN (POST JSON). */
@Injectable()
export class MomoGateway extends PaymentGateway {
  readonly provider = 'MOMO' as const;
  private readonly partnerCode: string;
  private readonly accessKey: string;
  private readonly secretKey: string;
  private readonly endpoint: string;

  constructor(config: ConfigService) {
    super();
    this.partnerCode = config.get<string>('MOMO_PARTNER_CODE') ?? '';
    this.accessKey = config.get<string>('MOMO_ACCESS_KEY') ?? '';
    this.secretKey = config.get<string>('MOMO_SECRET_KEY') ?? '';
    this.endpoint = config.get<string>('MOMO_ENDPOINT') || 'https://test-payment.momo.vn/v2/gateway/api/create';
  }

  get available(): boolean {
    return Boolean(this.partnerCode && this.accessKey && this.secretKey);
  }

  async start(order: Order, context: PaymentContext) {
    const body = {
      partnerCode: this.partnerCode,
      requestType: 'captureWallet',
      ipnUrl: context.notifyUrl,
      redirectUrl: context.returnUrl,
      orderId: order.code,
      amount: order.amount,
      orderInfo: `Thanh toan don ${order.code}`,
      requestId: randomUUID(),
      extraData: '',
      lang: 'vi',
    };
    const raw = `accessKey=${this.accessKey}&amount=${body.amount}&extraData=${body.extraData}&ipnUrl=${body.ipnUrl}`
      + `&orderId=${body.orderId}&orderInfo=${body.orderInfo}&partnerCode=${body.partnerCode}`
      + `&redirectUrl=${body.redirectUrl}&requestId=${body.requestId}&requestType=${body.requestType}`;
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, signature: sign(raw, this.secretKey) }),
      signal: AbortSignal.timeout(20_000),
    });
    const result = (await response.json()) as { resultCode?: number; payUrl?: string; message?: string };
    if (result.resultCode !== 0 || !result.payUrl) throw new Error(`MoMo refused the payment: ${result.message ?? response.status}`);
    return { redirectUrl: result.payUrl, bankTransfer: null };
  }

  async verify({ body }: IncomingNotification): Promise<PaymentResult[] | null> {
    const b = body as Record<string, string | number>;
    const raw = `accessKey=${this.accessKey}&amount=${b.amount}&extraData=${b.extraData ?? ''}&message=${b.message}`
      + `&orderId=${b.orderId}&orderInfo=${b.orderInfo}&orderType=${b.orderType}&partnerCode=${b.partnerCode}`
      + `&payType=${b.payType}&requestId=${b.requestId}&responseTime=${b.responseTime}&resultCode=${b.resultCode}&transId=${b.transId}`;
    const expected = sign(raw, this.secretKey);
    const received = String(b.signature ?? '');
    if (received.length !== expected.length || !timingSafeEqual(Buffer.from(received), Buffer.from(expected))) {
      throw new Error('MoMo signature mismatch');
    }
    return [{ orderCode: String(b.orderId), paid: Number(b.resultCode) === 0, amount: Number(b.amount), providerRef: String(b.transId) }];
  }

  override acknowledge(ok: boolean) {
    return { status: ok ? 204 : 400, body: ok ? undefined : { ok } };
  }
}
