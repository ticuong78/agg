import { RateLimiter } from './rate-limiter.js';
import { DomainError } from '../domain/domain-error.js';

/** Throws a 429 when `key` went over `limit` hits in the window. */
export async function enforceRateLimit(limiter: RateLimiter, key: string, limit: number, windowSeconds: number) {
  const wait = await limiter.hit(key, limit, windowSeconds);
  if (wait > 0) throw DomainError.rateLimited('request.rate_limited', 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.', wait);
}
