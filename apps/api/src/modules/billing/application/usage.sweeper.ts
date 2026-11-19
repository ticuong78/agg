import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Retention } from '@agg/contracts';
import { DailyUsageRepository } from '../domain/repositories.js';
import { today } from './billing.facade.js';

/**
 * GD-7: daily allowance counters hold the browser's random id and the hashed IP, and only today's is ever read.
 * Counters older than Retention.usageCounterDays are deleted every night, as the privacy page says.
 */
@Injectable()
export class UsageSweeper {
  private readonly logger = new Logger(UsageSweeper.name);

  constructor(private readonly daily: DailyUsageRepository) {}

  // Just after midnight in Vietnam, when a new allowance day starts: yesterday's counter is then the oldest kept.
  @Cron('5 0 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async sweep(now = new Date()): Promise<number> {
    const oldestKept = today(new Date(now.getTime() - (Retention.usageCounterDays - 1) * 86_400_000));
    const removed = await this.daily.deleteBefore(oldestKept);
    if (removed) this.logger.log(`Deleted ${removed} old usage counters`);
    return removed;
  }
}
