import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import { PaymentGateway, type IncomingNotification, type PaymentContext, type PaymentResult } from '../../application/ports.js';
import type { Order } from '../../domain/order.js';

const ORDER_CODE = /GD\d{8}/i;

/**
 * Bank transfer with a VietQR code (any Vietnamese banking app scans it). The QR carries the amount and the order
 * code as the transfer description. Confirmation comes from a bank-notification service (SePay webhook format:
 * `Authorization: Apikey <key>`), which reports incoming transfers on the receiving account.
 */
@Injectable()
export class VietQrGateway extends PaymentGateway {
  readonly provider = 'VIETQR' as const;
  private readonly bankId: string;
  private readonly bankName: string;
  private readonly accountNumber: string;
  private readonly accountName: string;
  private readonly webhookKey: string;

  constructor(config: ConfigService) {
    super();
    this.bankId = config.get<string>('VIETQR_BANK_ID') ?? '';
    this.bankName = config.get<string>('VIETQR_BANK_NAME') ?? this.bankId;
    this.accountNumber = config.get<string>('VIETQR_ACCOUNT_NUMBER') ?? '';
    this.accountName = config.get<string>('VIETQR_ACCOUNT_NAME') ?? '';
    this.webhookKey = config.get<string>('SEPAY_WEBHOOK_KEY') ?? '';
  }

  get available(): boolean {
    return Boolean(this.bankId && this.accountNumber && this.accountName && this.webhookKey);
  }

  async start(order: Order, _context: PaymentContext) {
    const query = new URLSearchParams({ amount: String(order.amount), addInfo: order.code, accountName: this.accountName });
    return {
      redirectUrl: null,
      bankTransfer: {
        imageUrl: `https://img.vietqr.io/image/${encodeURIComponent(this.bankId)}-${encodeURIComponent(this.accountNumber)}-compact2.png?${query}`,
        bankName: this.bankName,
        accountNumber: this.accountNumber,
        accountName: this.accountName,
        amount: order.amount,
        content: order.code,
      },
    };
  }

  async verify({ headers, body }: IncomingNotification): Promise<PaymentResult[] | null> {
    const expected = Buffer.from(`Apikey ${this.webhookKey}`);
    const received = Buffer.from(String(headers.authorization ?? ''));
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) throw new Error('Bank webhook key mismatch');
    const b = body as { id?: number | string; transferType?: string; transferAmount?: number; content?: string; accountNumber?: string };
    if (b.transferType !== 'in' || (b.accountNumber && b.accountNumber !== this.accountNumber)) return null;
    const code = ORDER_CODE.exec(b.content ?? '')?.[0]?.toUpperCase();
    if (!code) return null;
    return [{ orderCode: code, paid: true, amount: Number(b.transferAmount ?? 0), providerRef: `sepay:${b.id ?? ''}` }];
  }

  override acknowledge(ok: boolean) {
    return { status: ok ? 200 : 401, body: { success: ok } };
  }
}
