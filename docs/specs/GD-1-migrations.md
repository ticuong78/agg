# GD-1: Schema changes through migrations instead of DB_SYNC

Status: done (approved by Htet Oo Naing 2026-11-17; implemented the same day)
Owner: Htet Oo Naing
Risky area: yes (schema and startup: `app.module.ts`, `config/environment.ts`, migrations; `.env.example`; `docker-compose*.yml`)
MVP: in (prerequisite: GD-3, GD-5 and GD-6 add or change tables)
Waits on: nothing (GD-0 done)

## Outcome

Every schema change reaches the database through a reviewed, versioned migration that the API applies at startup, so a deploy can no longer silently drop or alter a column. Follows OnlineJudge ADR 0003 and OJ-5, including what OJ-26 and OJ-28 added later (advisory lock, no retry of a failed migration).

## Scope

In:
- **Shared database options** in `apps/api/src/database.ts`, used by `app.module.ts` and by the command line (`data-source.ts`, `migrate.ts`). Ported from OnlineJudge's `database.ts`: `databaseOptions`, `withMigrationLock` (PostgreSQL advisory lock, waits up to 10 minutes), `prepareDatabase` (all pending migrations in one transaction, then `synchronize` only when `DB_SYNC=true`), `openDatabase`, `DatabasePreparationError` and `retryDatabaseError` (Nest's connection retry never repeats a failed migration).
- **Startup:** `TypeOrmModule.forRootAsync` gets a `dataSourceFactory` that calls `openDatabase`, so migrations run before any module reads the database. TypeORM's own `migrationsRun` stays off.
- **The first migration** `apps/api/src/migrations/<timestamp>-baseline.ts`, listed in `migrations/index.ts`: generated from the current entities (14 tables: `users`, `sign_in_codes`, `wallets`, `ledger_entries`, `subscriptions`, `orders`, `workspaces`, `daily_usage`, `conversions`, `visitors`, `leads`, `reward_claims`, `referrals`, `analytics_events`) against an empty database with `DB_SYNC=false`. Then edited by hand to use `IF NOT EXISTS`, so a database that `DB_SYNC` already built is recorded as migrated instead of failing. ~~The baseline's `down` drops the tables (local and test only; never run against data).~~ **Changed during implementation:** the baseline's `down` refuses with a clear error instead. One stray `migration:revert` on production would otherwise drop every table with its data, which is the lesson behind OnlineJudge's R10. Later migrations stay revertible.
- **Scripts** in `apps/api/package.json`: `migration:generate`, `migration:run`, `migration:revert` (these two under the same lock), `migration:show`, `migration:check` (fails when the entities and the migrations differ). Root: `infra:test:up`, `infra:test:down`, `test:integration`.
- **Configuration:** `.env.example` ships `DB_SYNC=false`. `DB_SYNC=true` with `NODE_ENV=production` becomes a startup error in `environment.ts` (today a warning). `DB_SYNC=true` stays allowed for a throwaway local database and runs after the migrations.
- **Test database:** `docker-compose.test.yml` with a throwaway Postgres 17 on `127.0.0.1:55433`. Port 55432 is OnlineJudge's, which already runs on this Mac.
- **Docs:** `docs/DEPLOY.md` (first deploy and upgrades: back up, deploy, the API migrates; no more `DB_SYNC=true` on first deploy), `README.md` (development commands), `docs/ARCHITECTURE.md` ("intentionally not done" loses the migration line), `CLAUDE.md` (commands; the test rule widened to integration tests), ADR `0002-schema-migrations.md`, playbook rows marked done.

Out:
- CI running the check: that is GD-2, which reuses `test:integration`.
- Data migrations: no existing rows need fixing.
- Changing the entities: the baseline describes them as they are.

## Done when

- [x] On an empty database, the migrations build the whole schema, and TypeORM then reports no difference from the entities (drift guard in `migrations.integration.test.ts`).
- [x] On a database that `DB_SYNC` built, with rows in it, the baseline changes nothing, is recorded as applied, and the rows stay.
- [x] Running the migrations again does nothing; two `prepareDatabase` calls at the same time apply the baseline once (the lock).
- [x] A failing migration leaves the database unchanged, and the API refuses to start without retrying.
- [x] `migration:run`, `migration:show`, `migration:revert` (refused for the baseline; a later migration is reverted and re-run in the integration test), then `migration:run` again, all work from the command line against the throwaway database. `migration:check` passes, and fails after a test edit to an entity (edit undone).
- [x] `DB_SYNC=true` with `NODE_ENV=production` is a startup error (test in `environment.test.ts`); `.env.example` has `DB_SYNC=false`.
- [x] The API starts against the local `infra:up` database with `DB_SYNC=false`, `GET /api/health` answers `{"ok":true}`, and a guest conversion can be created and exported.
- [x] `pnpm build:contracts && pnpm typecheck && pnpm test` pass, and `pnpm test:integration` passes against the throwaway database.

## Plan

1. `docker-compose.test.yml`; root scripts `infra:test:up`, `infra:test:down`, `test:integration`.
2. `apps/api/src/database.ts`, `data-source.ts` (reads `.env`, `.env.local`; entities found by `modules/*/infrastructure/*.{ts,js}`), `migrate.ts`; scripts in `apps/api/package.json`.
3. `app.module.ts`: `dataSourceFactory` with `openDatabase`, `retryAttempts` and `toRetry: retryDatabaseError`.
4. Generate the baseline against an empty throwaway database; add `IF NOT EXISTS`; `migrations/index.ts`.
5. `config/environment.ts`: `DB_SYNC=true` in production is an error; `.env.example`.
6. Tests: `test/support/throwaway.ts`, `test/support/migrated-schema.ts`, `test/migrations.integration.test.ts`, `test/environment.test.ts`.
7. Docs and ADR 0002; the security-verifier agent on the diff; `/review`.

## Contexts, contracts and configuration

No bounded context changes: only the API's composition root (`app.module.ts`), `config/` and new top-level files in `apps/api/src`. No contract changes. Configuration: `DB_SYNC` default and production rule; new `TEST_DATABASE_URL` (tests only; the suite refuses the development port 5433 outside CI). ADR to write: `docs/adr/0002-schema-migrations.md`.

## Security and data

No routes. Migrations run as the app's database user, with no new credentials. The test helper refuses to run against the development database, so test schemas never mix with local data. No user data added. Before the first production run: a backup (`deploy/backup.sh`).

## Tests and fixtures

- `apps/api/test/migrations.integration.test.ts`: empty database plus drift guard; `DB_SYNC`-built database with rows; running twice; concurrent `prepareDatabase`; a failing migration rolls back and is not retried; revert and run again. Each test uses its own schema, dropped afterwards. Skipped when `TEST_DATABASE_URL` is unset, so `pnpm test` stays database-free.
- `apps/api/test/environment.test.ts`: `DB_SYNC=true` refused in production, allowed in development.
- No browser check: nothing a teacher sees changes. The live check is the API starting with `DB_SYNC=false` and a guest conversion through the API.

## Rollout and risks

1. **Open question for Htet: is there a deployed database today?** If yes, it was built by `DB_SYNC`: back it up, deploy, and the API records the baseline without changes (covered by the second "done when" test). If no, the first deploy builds the schema from the baseline.
2. From then on, every entity change ships with a generated migration, reviewed in its PR.
3. Risk: an entity that `DB_SYNC` built differently on an older deploy than the current code (for example a column type). The drift guard only compares against the current entities. Mitigation: before the first production run, run `migration:check` against a copy of the production database.

Rollback: `migration:revert` for later migrations; for the baseline, restore the backup.

## Verification (2026-11-17)

- **Gate:** `pnpm build:contracts` OK; `pnpm typecheck` Done for contracts, api, web; `pnpm test` tests 35, pass 35, fail 0 (database-free: integration files are excluded from `test`).
- **Integration:** `pnpm test:integration` against the throwaway database (55433): tests 8, pass 8, fail 0.
- **Command line** (throwaway database, `public` schema reset first): `migration:show` `[ ] Baseline1794911961474`; `migration:run` "Migrations are up to date."; `migration:show` `[X] 1 Baseline1794911961474`; `migration:revert` refused ("cannot be reverted", exit 1); `migration:run` again "up to date"; `migration:check` "No changes in database schema were found".
- **Drift guard proven:** a temporary `drift_probe` column on the conversion entity made `migration:check` report unexpected changes and failed 2 integration tests; the file was restored (no diff).
- **Live:** the built API (`node dist/main.js`, `DB_SYNC=false`, no `ANTHROPIC_API_KEY`) against the never-used local `infra:up` database: 15 tables (14 plus `migrations`), `Baseline1794911961474` recorded, `GET /api/health` `{"ok":true}`, a pasted two-problem exam read as `TONG`, `MAX` (`READY`), and `export/contest` returned a 1510-byte zip with `Tasks/TONG/`, `Tasks/MAX/`, `Contestants/`, `DeBai.md`, `DOC-TRUOC.txt`.
- **Reviews:** `reviewer` agent (0 blocking, 4 should fix, 7 nits) and `security-verifier` (no high-severity finding). Fixed: Verification filled; playbook enforcement labels and the gate step for entity changes; one recipe for `migration:generate` (on the throwaway database) in CLAUDE.md and DEPLOY.md; entity glob widened to subfolders; integration files excluded from `pnpm test`; the DB_SYNC upgrade test now goes through `openDatabase`; `retryAttempts`/`retryDelay` set explicitly; `NODE_ENV` read without regard to case or spaces; the test-database guard refuses `host`/`port` query parameters and reads `PGPORT`; DEPLOY.md gives `node dist/migrate.js` for the production container (no `tsx` there); the brief's "Missing" line dated.
- **Lock release fixed after review:** if `pg_advisory_unlock` fails, the lock's connection used to return to the pool still holding the lock, so other APIs would wait 10 minutes and refuse to start. It is now released with the error, so pg-pool destroys it and the session's lock ends (`releaseLockConnection` in `database.ts`). A new integration test failed before the fix (`lock was freed`: actual false) and passes after.
- **Not done, recorded:** `DB_SYNC` after the migrations is not in a transaction (local only). Session advisory locks would not work behind a transaction-pooling PgBouncer (not used). No `.dockerignore` (pre-existing).
- **Docker:** `docker build -f deploy/Dockerfile.api` succeeds; the image has `dist/migrations/` (baseline and index) and no `tsx`, as DEPLOY.md says.
- **Not checked:** a database that `DB_SYNC` built from older code (no deployed database was reported); the hooks on push.
