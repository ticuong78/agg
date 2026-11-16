import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingModule } from '../billing/billing.module.js';
import { IdentityModule } from '../identity/identity.module.js';
import { GrowthErasure } from './application/account-erasure.js';
import { LeadService } from './application/lead.service.js';
import { CreditGranter, GrowthIdentityPort } from './application/ports.js';
import { RewardsService } from './application/rewards.service.js';
import { TrackingService } from './application/tracking.service.js';
import {
  AnalyticsEventRepository, LeadRepository, ReferralRepository, RewardClaimRepository, VisitorRepository,
} from './domain/repositories.js';
import { BillingCreditGranter, IdentityGrowthGateway } from './infrastructure/adapters.js';
import {
  AnalyticsEventOrmEntity, LeadOrmEntity, ReferralOrmEntity, RewardClaimOrmEntity, TypeOrmAnalyticsEventRepository, TypeOrmLeadRepository,
  TypeOrmReferralRepository, TypeOrmRewardClaimRepository, TypeOrmVisitorRepository, VisitorOrmEntity,
} from './infrastructure/persistence.js';
import { AdminGrowthController, GrowthController, RewardsController } from './presentation/growth.controllers.js';

@Module({
  imports: [
    IdentityModule,
    BillingModule,
    TypeOrmModule.forFeature([VisitorOrmEntity, LeadOrmEntity, RewardClaimOrmEntity, ReferralOrmEntity, AnalyticsEventOrmEntity]),
  ],
  controllers: [GrowthController, RewardsController, AdminGrowthController],
  providers: [
    TrackingService,
    LeadService,
    RewardsService,
    GrowthErasure,
    { provide: CreditGranter, useClass: BillingCreditGranter },
    { provide: GrowthIdentityPort, useClass: IdentityGrowthGateway },
    { provide: VisitorRepository, useClass: TypeOrmVisitorRepository },
    { provide: LeadRepository, useClass: TypeOrmLeadRepository },
    { provide: RewardClaimRepository, useClass: TypeOrmRewardClaimRepository },
    { provide: ReferralRepository, useClass: TypeOrmReferralRepository },
    { provide: AnalyticsEventRepository, useClass: TypeOrmAnalyticsEventRepository },
  ],
})
export class GrowthModule {}
