import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PaymentGateway, type IncomingNotification, type PaymentContext, type PaymentResult } from '../../application/ports.js';
import type { Order } from '../../domain/order.js';

/** VNPay date format, Vietnam time: yyyyMMddHHmmss. */
export function vnpDate(date: Date): string {
  const local = new Date(date.getTime() + 7 * 3_600_000);
  return local.toISOString().replace(/[-:T]/g, '').slice(0, 14);
}

/** VNPay signs the sorted, form-encoded parameters (spaces as "+") with HMAC-SHA512. */
export function vnpSign(params: Record<string, string>, secret: string): string {
  const data = Object.keys(params)
    .filter((k) => params[k] !== '' && params[k] !== undefined)
    .sort()
    .map((k) => `${k}=${encodeURIComponent(params[k]).replace(/%20/g, '+')}`)
    .join('&');
  return createHmac('sha512', secret).update(Buffer.from(data, 'utf8')).digest('hex');
}

/** VNPay payment gateway (API 2.1.0): redirect to the hosted page, confirmation by IPN (server-to-server GET). */
@Injectable()
export class VnpayGateway extends PaymentGateway {
  readonly provider = 'VNPAY' as const;
  private readonly tmnCode: string;
  private readonly secret: string;
  private readonly payUrl: string;

  constructor(config: ConfigService) {
    super();
    this.tmnCode = config.get<string>('VNPAY_TMN_CODE') ?? '';
    this.secret = config.get<string>('VNPAY_HASH_SECRET') ?? '';
    this.payUrl = config.get<string>('VNPAY_PAY_URL') || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
  }

  get available(): boolean {
    return Boolean(this.tmnCode && this.secret);
  }

  async start(order: Order, context: PaymentContext) {
    const now = new Date();
    const params: Record<string, string> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: this.tmnCode,
      vnp_Amount: String(order.amount * 100),
      vnp_CurrCode: 'VND',
      vnp_TxnRef: order.code,
      vnp_OrderInfo: `Thanh toan don ${order.code}`,
      vnp_OrderType: 'other',
      vnp_Locale: 'vn',
      vnp_ReturnUrl: context.returnUrl,
      vnp_IpAddr: context.clientIp || '127.0.0.1',
      vnp_CreateDate: vnpDate(now),
      vnp_ExpireDate: vnpDate(new Date(now.getTime() + 15 * 60_000)),
    };
    const query = new URLSearchParams({ ...params, vnp_SecureHash: vnpSign(params, this.secret) });
    return { redirectUrl: `${this.payUrl}?${query.toString()}`, bankTransfer: null };
  }

  async verify({ query }: IncomingNotification): Promise<PaymentResult[] | null> {
    const params: Record<string, string> = {};
    for (const [k, v] of Object.entries(query)) if (k.startsWith('vnp_') && typeof v === 'string') params[k] = v;
    const received = params.vnp_SecureHash ?? '';
    delete params.vnp_SecureHash;
    delete params.vnp_SecureHashType;
    const expected = vnpSign(params, this.secret);
    if (received.length !== expected.length || !timingSafeEqual(Buffer.from(received.toLowerCase()), Buffer.from(expected))) {
      throw new Error('VNPay checksum mismatch');
    }
    return [{
      orderCode: params.vnp_TxnRef,
      paid: params.vnp_ResponseCode === '00' && params.vnp_TransactionStatus === '00',
      amount: Math.round(Number(params.vnp_Amount) / 100),
      providerRef: params.vnp_TransactionNo ?? '',
    }];
  }

  override acknowledge(ok: boolean) {
    return { status: 200, body: ok ? { RspCode: '00', Message: 'Confirm Success' } : { RspCode: '97', Message: 'Invalid Checksum' } };
  }
}
