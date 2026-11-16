import { Injectable } from '@nestjs/common';
import type { CreditAction } from '@agg/contracts';
import type { Requester } from '../../../shared/application/requester.js';
import { BillingFacade } from '../../billing/application/billing.facade.js';
import { UsageGateway, type UsageProfile } from '../application/ports.js';

/** Anti-corruption layer: Conversion asks Billing through its facade only. */
@Injectable()
export class BillingFacadeGateway extends UsageGateway {
  constructor(private readonly billing: BillingFacade) {
    super();
  }

  profile(requester: Requester) {
    return this.billing.profile(requester);
  }
  consumeConversion(requester: Requester, profile: UsageProfile) {
    return this.billing.consumeConversion(requester, profile);
  }
  assertCanAfford(requester: Requester, action: CreditAction, units: number) {
    return this.billing.assertCanAfford(requester, action, units);
  }
  charge(requester: Requester, action: CreditAction, units: number, reference: string) {
    return this.billing.charge(requester, action, units, reference);
  }
}
