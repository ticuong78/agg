/**
 * The data source for the TypeORM command line (GD-1): `pnpm --filter @agg/api migration:show | migration:generate |
 * migration:check`. `migration:run` and `migration:revert` go through migrate.ts, which takes the migration lock. It
 * reads the same `.env` files as the API; variables already set take precedence. The API itself runs the migrations
 * at startup and does not use this file.
 */
import 'reflect-metadata';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { databaseOptions } from './database.js';

for (const file of ['.env', '.env.local']) {
  try {
    process.loadEnvFile(file);
  } catch {
    // Missing file: use the environment as it is.
  }
}

export default new DataSource({
  ...databaseOptions((key) => process.env[key]),
  // The command line never alters the schema on its own; it only runs, reverts or compares migrations.
  migrationsRun: false,
  synchronize: false,
  // The API finds entities through its modules (autoLoadEntities); here they are found by file, so a new entity file
  // anywhere under a context's infrastructure folder is compared too.
  entities: [join(__dirname, 'modules/*/infrastructure/**/*.{ts,js}')],
});
