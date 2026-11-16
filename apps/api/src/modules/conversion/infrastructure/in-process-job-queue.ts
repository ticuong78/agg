import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobQueue } from '../application/ports.js';

/**
 * Background work inside the API process, a few jobs at a time, paid plans first. Enough for one VPS:
 * uploads are never written to disk, so a job cannot outlive the process anyway (see ConversionService bootstrap).
 */
@Injectable()
export class InProcessJobQueue extends JobQueue {
  private readonly logger = new Logger(InProcessJobQueue.name);
  private readonly priority: (() => Promise<void>)[] = [];
  private readonly normal: (() => Promise<void>)[] = [];
  private running = 0;
  private readonly concurrency: number;

  constructor(config: ConfigService) {
    super();
    this.concurrency = Math.max(1, Number(config.get('EXTRACTION_CONCURRENCY') ?? 3));
  }

  enqueue(job: () => Promise<void>, priority: boolean): void {
    (priority ? this.priority : this.normal).push(job);
    this.drain();
  }

  private drain(): void {
    while (this.running < this.concurrency) {
      const job = this.priority.shift() ?? this.normal.shift();
      if (!job) return;
      this.running++;
      job()
        .catch((error: unknown) => this.logger.error(`Job failed: ${(error as Error).message}`))
        .finally(() => {
          this.running--;
          this.drain();
        });
    }
  }
}
