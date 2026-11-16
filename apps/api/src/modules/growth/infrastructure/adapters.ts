import { Injectable } from '@nestjs/common';
import { BillingFacade } from '../../billing/application/billing.facade.js';
import { IdentityFacade } from '../../identity/application/identity.facade.js';
import { CreditGranter, GrowthIdentityPort } from '../application/ports.js';

@Injectable()
export class BillingCreditGranter extends CreditGranter {
  constructor(private readonly billing: BillingFacade) {
    super();
  }
  grant(userId: string, credits: number, reference: string, reason: string) {
    return this.billing.grantReward(userId, credits, reference, reason);
  }
}

@Injectable()
export class IdentityGrowthGateway extends GrowthIdentityPort {
  constructor(private readonly identity: IdentityFacade) {
    super();
  }
  find(userId: string) {
    return this.identity.find(userId);
  }
  findMany(userIds: string[]) {
    return this.identity.findMany(userIds);
  }
}
