import { Injectable } from '@nestjs/common';
import { RateLimiter } from '../application/rate-limiter.js';

/** In-process fixed windows. The API runs as one process on the VPS; a cluster would need a shared store. */
@Injectable()
export class MemoryRateLimiter extends RateLimiter {
  private readonly windows = new Map<string, { count: number; resetAt: number }>();

  async hit(key: string, limit: number, windowSeconds: number): Promise<number> {
    const now = Date.now();
    let window = this.windows.get(key);
    if (!window || window.resetAt <= now) {
      window = { count: 0, resetAt: now + windowSeconds * 1000 };
      this.windows.set(key, window);
      if (this.windows.size > 50_000) this.sweep(now);
    }
    window.count++;
    return window.count > limit ? Math.ceil((window.resetAt - now) / 1000) : 0;
  }

  private sweep(now: number) {
    for (const [key, w] of this.windows) if (w.resetAt <= now) this.windows.delete(key);
  }
}
