import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConversionRepository } from '../domain/repositories.js';

/** Retention promise of the privacy policy: expired conversions are deleted, not just hidden. */
@Injectable()
export class RetentionSweeper {
  private readonly logger = new Logger(RetentionSweeper.name);

  constructor(private readonly conversions: ConversionRepository) {}

  @Cron(CronExpression.EVERY_HOUR)
  async sweep(): Promise<void> {
    const removed = await this.conversions.deleteExpired(new Date());
    if (removed) this.logger.log(`Deleted ${removed} expired conversions`);
  }
}
