# ADR 0002: Schema changes go through migrations

Date: 2026-11-17
Status: accepted (decision owner: Htet Oo Naing; implemented in `docs/specs/GD-1-migrations.md`)

## Context

Until GD-1 the schema was created and altered by TypeORM `synchronize`, switched on by `DB_SYNC` (`app.module.ts`; `.env.example` shipped `DB_SYNC=true` "for the first deploy"). In production `environment.ts` only warned about it. `synchronize` compares entities with the live database at startup and alters tables to match: a renamed or removed property drops the column and its data, with no review and no rollback. The MVP adds tables (GD-3, GD-5, GD-6), so this has to change before them. OnlineJudge made the same decision (its ADR 0003) and learned three lessons afterwards: lock concurrent startups, never retry a failed migration, and never let the baseline be reverted.

## Decision

Use TypeORM migrations, checked into `apps/api/src/migrations/` and listed by hand in `migrations/index.ts`, starting from a baseline generated from the entities at commit `1f6726a`. The API runs pending migrations at startup, in one transaction, under a PostgreSQL advisory lock, before it accepts requests (`src/database.ts`). A failed migration stops startup without retries. The baseline uses `IF NOT EXISTS`, so a database that `DB_SYNC` built is recorded as migrated, and it cannot be reverted. `DB_SYNC=true` is a startup error in production and is kept only for throwaway local databases, where it runs after the migrations.

## Consequences

- Every entity change ships with a generated migration, reviewed in the same PR; a reviewer can see what SQL a deploy will run.
- An integration test (`migrations.integration.test.ts`) and `migration:check` fail when the entities and the migrations differ. They need a throwaway Postgres (`docker-compose.test.yml`), and CI runs them from GD-2.
- One extra command for contributors (`migration:generate`), and integration tests need Docker.
- A database built by `DB_SYNC` from older code may differ from the current entities in ways the baseline's `IF NOT EXISTS` hides; `migration:check` against a copy of it before the first production run catches that (`docs/DEPLOY.md`).
