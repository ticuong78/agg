/** Port: fixed-window counter. Returns how many seconds to wait when the limit is reached, else 0. */
export abstract class RateLimiter {
  abstract hit(key: string, limit: number, windowSeconds: number): Promise<number>;
}
