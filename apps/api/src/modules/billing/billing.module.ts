import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdentityModule } from '../identity/identity.module.js';
import { AccountResolver } from './application/account-resolver.js';
import { BillingFacade } from './application/billing.facade.js';
import { UsageSweeper } from './application/usage.sweeper.js';
import { CheckoutService } from './application/checkout.service.js';
import { Fulfilment } from './application/fulfilment.js';
import { BillingErasure } from './application/account-erasure.js';
import { BillingIdentityPort } from './application/identity.port.js';
import { PaymentGateways } from './application/ports.js';
import { UsageService } from './application/usage.service.js';
import { WorkspaceService } from './application/workspace.service.js';
import {
  DailyUsageRepository, OrderRepository, SubscriptionRepository, WalletRepository, WorkspaceRepository,
} from './domain/repositories.js';
import { ConfiguredPaymentGateways, GATEWAYS, IdentityFacadeGateway } from './infrastructure/adapters.js';
import {
  DailyUsageOrmEntity, LedgerOrmEntity, OrderOrmEntity, SubscriptionOrmEntity, TypeOrmDailyUsageRepository, TypeOrmOrderRepository,
  TypeOrmSubscriptionRepository, TypeOrmWalletRepository, TypeOrmWorkspaceRepository, WalletOrmEntity, WorkspaceOrmEntity,
} from './infrastructure/persistence.js';
import { BillingController, PaymentWebhooksController, WorkspaceController } from './presentation/billing.controllers.js';

@Module({
  imports: [
    IdentityModule,
    TypeOrmModule.forFeature([WalletOrmEntity, LedgerOrmEntity, SubscriptionOrmEntity, OrderOrmEntity, WorkspaceOrmEntity, DailyUsageOrmEntity]),
  ],
  controllers: [BillingController, PaymentWebhooksController, WorkspaceController],
  providers: [
    AccountResolver,
    BillingFacade,
    UsageService,
    UsageSweeper,
    CheckoutService,
    WorkspaceService,
    Fulfilment,
    BillingErasure,
    ...GATEWAYS,
    { provide: PaymentGateways, useClass: ConfiguredPaymentGateways },
    { provide: BillingIdentityPort, useClass: IdentityFacadeGateway },
    { provide: WalletRepository, useClass: TypeOrmWalletRepository },
    { provide: SubscriptionRepository, useClass: TypeOrmSubscriptionRepository },
    { provide: OrderRepository, useClass: TypeOrmOrderRepository },
    { provide: WorkspaceRepository, useClass: TypeOrmWorkspaceRepository },
    { provide: DailyUsageRepository, useClass: TypeOrmDailyUsageRepository },
  ],
  exports: [BillingFacade],
})
export class BillingModule {}
