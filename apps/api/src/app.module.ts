import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { validateEnvironment } from './config/environment.js';
import { databaseOptions, openDatabase, retryDatabaseError } from './database.js';
import { HealthController } from './health.controller.js';
import { BillingModule } from './modules/billing/billing.module.js';
import { ConversionModule } from './modules/conversion/conversion.module.js';
import { GrowthModule } from './modules/growth/growth.module.js';
import { IdentityModule } from './modules/identity/identity.module.js';
import { SharedModule } from './shared/shared.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '.env.local'], validate: validateEnvironment }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...databaseOptions((key) => config.get<string>(key)),
        autoLoadEntities: true,
        // A database that is not up yet is retried; a failed migration is not (it would run again each time).
        toRetry: retryDatabaseError,
        retryAttempts: 10,
        retryDelay: 3000,
      }),
      // Migrations under a lock, then DB_SYNC on a throwaway local database, before any module reads the database (GD-1).
      dataSourceFactory: (options) => openDatabase(options!),
    }),
    SharedModule,
    // Bounded contexts. Dependency direction: growth -> billing -> identity; conversion -> billing.
    IdentityModule,
    BillingModule,
    ConversionModule,
    GrowthModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
