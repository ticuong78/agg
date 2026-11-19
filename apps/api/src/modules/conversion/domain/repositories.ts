import type { Conversion } from './conversion.js';

export abstract class ConversionRepository {
  abstract findById(id: string): Promise<Conversion | null>;
  abstract listByOwner(userId: string, limit: number): Promise<Conversion[]>;
  /** Stores a new set. */
  abstract insert(conversion: Conversion): Promise<void>;
  /**
   * Updates an existing set. A set deleted meanwhile (by its owner, or by the retention sweep) stays deleted: a job
   * or an edit that loaded it earlier must not bring its content back (GD-7).
   */
  abstract save(conversion: Conversion): Promise<void>;
  abstract delete(id: string): Promise<void>;
  abstract deleteByOwner(userId: string): Promise<void>;
  /** Removes every conversion whose retention ended; returns how many went. */
  abstract deleteExpired(now: Date): Promise<number>;
  /** Conversions left PROCESSING by a restart (their files are gone with the process). */
  abstract failInterrupted(reason: string): Promise<number>;
}
