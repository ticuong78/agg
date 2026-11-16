import type { Conversion } from './conversion.js';

export abstract class ConversionRepository {
  abstract findById(id: string): Promise<Conversion | null>;
  abstract listByOwner(userId: string, limit: number): Promise<Conversion[]>;
  abstract save(conversion: Conversion): Promise<void>;
  abstract delete(id: string): Promise<void>;
  abstract deleteByOwner(userId: string): Promise<void>;
  /** Removes every conversion whose retention ended; returns how many went. */
  abstract deleteExpired(now: Date): Promise<number>;
  /** Conversions left PROCESSING by a restart (their files are gone with the process). */
  abstract failInterrupted(reason: string): Promise<number>;
}
