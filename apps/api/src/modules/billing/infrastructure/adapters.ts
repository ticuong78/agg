import { Injectable } from '@nestjs/common';
import type { PaymentProvider } from '@agg/contracts';
import { IdentityFacade } from '../../identity/application/identity.facade.js';
import { BillingIdentityPort } from '../application/identity.port.js';
import { PaymentGateways, type PaymentGateway } from '../application/ports.js';
import { MomoGateway } from './payments/momo.gateway.js';
import { StripeGateway } from './payments/stripe.gateway.js';
import { VietQrGateway } from './payments/vietqr.gateway.js';
import { VnpayGateway } from './payments/vnpay.gateway.js';

@Injectable()
export class ConfiguredPaymentGateways extends PaymentGateways {
  private readonly list: PaymentGateway[];

  constructor(stripe: StripeGateway, vnpay: VnpayGateway, momo: MomoGateway, vietqr: VietQrGateway) {
    super();
    this.list = [stripe, vnpay, momo, vietqr];
  }

  get(provider: PaymentProvider): PaymentGateway {
    const gateway = this.list.find((g) => g.provider === provider);
    if (!gateway) throw new Error(`Unknown provider ${provider}`);
    return gateway;
  }

  all(): PaymentGateway[] {
    return this.list;
  }
}

export const GATEWAYS = [StripeGateway, VnpayGateway, MomoGateway, VietQrGateway];

@Injectable()
export class IdentityFacadeGateway extends BillingIdentityPort {
  constructor(private readonly identity: IdentityFacade) {
    super();
  }

  find(userId: string) {
    return this.identity.find(userId);
  }

  async findMany(userIds: string[]) {
    return this.identity.findMany(userIds);
  }
}
