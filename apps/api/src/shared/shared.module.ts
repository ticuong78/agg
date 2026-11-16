import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventPublisher } from './application/event-publisher.js';
import { Mailer } from './application/mailer.js';
import { RateLimiter } from './application/rate-limiter.js';
import { ClaudeClient, createClaudeClient } from './infrastructure/claude.js';
import { MemoryRateLimiter } from './infrastructure/memory-rate-limiter.js';
import { NestEventPublisher } from './infrastructure/nest-event-publisher.js';
import { SmtpMailer } from './infrastructure/smtp-mailer.js';

@Global()
@Module({
  providers: [
    { provide: EventPublisher, useClass: NestEventPublisher },
    { provide: Mailer, useClass: SmtpMailer },
    { provide: RateLimiter, useClass: MemoryRateLimiter },
    { provide: ClaudeClient, inject: [ConfigService], useFactory: createClaudeClient },
  ],
  exports: [EventPublisher, Mailer, RateLimiter, ClaudeClient],
})
export class SharedModule {}
