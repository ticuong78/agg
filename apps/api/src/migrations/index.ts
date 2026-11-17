import type { MigrationInterface } from 'typeorm';
import { Baseline1794911961474 } from './1794911961474-baseline.js';

/**
 * Every migration, oldest first. Listed by hand rather than found by a file pattern, so the compiled API (dist/) and
 * the TypeORM command line (tsx on src/) load exactly the same set. A new migration from `migration:generate` is
 * added here in the same PR.
 */
export const MIGRATIONS: (new () => MigrationInterface)[] = [Baseline1794911961474];
