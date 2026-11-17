import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';
import { DataSource, type DataSourceOptions, type MigrationInterface, type QueryRunner } from 'typeorm';
import { DatabasePreparationError, MIGRATION_LOCK, openDatabase, prepareDatabase, retryDatabaseError } from '../src/database.js';
import { MIGRATIONS } from '../src/migrations/index.js';
import { ALL_ENTITIES, migratedOptions } from './support/migrated-schema.js';
import { throwawayDatabase } from './support/throwaway.js';

/**
 * The migrations (GD-1) on the kinds of database a deploy meets: empty, and one that DB_SYNC already built with rows in
 * it. Also the guard that keeps them honest: after the migrations, the entities and the database must not differ, so
 * an entity change without a migration fails here (and in CI, GD-2). Each test uses its own schema, dropped after.
 *   pnpm infra:test:up   then   pnpm test:integration
 */
const { url, skip } = throwawayDatabase();

describe('migrations', { skip }, () => {
  let admin: DataSource;
  const schemas: string[] = [];

  before(async () => {
    admin = new DataSource({ type: 'postgres', url });
    await admin.initialize();
  });

  after(async () => {
    for (const s of schemas) await admin?.query(`DROP SCHEMA IF EXISTS "${s}" CASCADE`);
    await admin?.destroy();
  });

  const newSchema = async () => {
    const schema = `agg_mig_${randomBytes(4).toString('hex')}`;
    schemas.push(schema);
    await admin.query(`CREATE SCHEMA "${schema}"`);
    return schema;
  };
  const open = async (options: DataSourceOptions) => new DataSource(options).initialize();
  /** What TypeORM would still change to match the entities: must be nothing. */
  const drift = async (ds: DataSource) => (await ds.driver.createSchemaBuilder().log()).upQueries.map((q) => q.query);
  const applied = async (ds: DataSource) =>
    ((await ds.query('SELECT name FROM migrations ORDER BY id')) as { name: string }[]).map((r) => r.name);
  const ALL = MIGRATIONS.map((m) => new m().name);
  const table = async (ds: DataSource, name: string) => (await ds.query('SELECT to_regclass($1) AS t', [name]))[0].t as string | null;

  test('an empty database gets the whole schema, and the entities match it exactly (drift guard)', async () => {
    const ds = await open(migratedOptions(url!, await newSchema(), ALL_ENTITIES));
    try {
      assert.deepEqual(await applied(ds), ALL);
      assert.deepEqual(await drift(ds), [], 'an entity changed without a migration: run migration:generate');
      assert.deepEqual(await ds.runMigrations(), [], 'running again does nothing');
    } finally {
      await ds.destroy();
    }
  });

  test('a database DB_SYNC built before migrations existed is only recorded as migrated; its rows stay', async () => {
    const schema = await newSchema();
    // What the first deploy made with DB_SYNC=true: tables from the entities, no migrations table.
    const synced = await open({ ...migratedOptions(url!, schema, ALL_ENTITIES), migrations: [], migrationsRun: false, synchronize: true });
    const id = randomUUID();
    await synced.query(
      `INSERT INTO conversions (id, status, sources, problems, settings, created_at, expires_at)
       VALUES ($1, 'READY', '[]', '[]', '{}', now(), now() + interval '1 day')`,
      [id],
    );
    assert.equal(await table(synced, 'migrations'), null);
    await synced.destroy();

    // The upgrade as production runs it: openDatabase, under the lock.
    const ds = await openDatabase({ ...migratedOptions(url!, schema, ALL_ENTITIES), migrationsRun: false });
    try {
      assert.deepEqual(await applied(ds), ALL);
      assert.deepEqual(await drift(ds), []);
      assert.equal((await ds.query('SELECT id FROM conversions'))[0].id, id, 'the row is still there');
    } finally {
      await ds.destroy();
    }
  });

  test('with DB_SYNC (local only) the migrations run first, then sync; the result has no drift', async () => {
    const ds = await openDatabase({ ...migratedOptions(url!, await newSchema(), ALL_ENTITIES), synchronize: true });
    try {
      assert.deepEqual(await applied(ds), ALL);
      assert.deepEqual(await drift(ds), []);
    } finally {
      await ds.destroy();
    }
  });

  test('prepareDatabase from several places at once (two APIs, or an API and migration:run) applies each migration once', async () => {
    const options = { ...migratedOptions(url!, await newSchema(), ALL_ENTITIES), migrationsRun: false };
    const [a, b] = await Promise.all([open(options), open(options)]);
    try {
      await Promise.all([prepareDatabase(a), prepareDatabase(b), prepareDatabase(a)]);
      assert.deepEqual(await applied(a), ALL, 'each migration recorded exactly once');
      assert.deepEqual(await drift(a), []);
    } finally {
      await Promise.all([a.destroy(), b.destroy()]);
    }
  });

  test('a later migration can be reverted and run again; the baseline itself cannot be reverted', async () => {
    class AddNote1799999999000 implements MigrationInterface {
      name = 'AddNote1799999999000';
      async up(q: QueryRunner) {
        await q.query('CREATE TABLE test_notes (id int PRIMARY KEY)');
      }
      async down(q: QueryRunner) {
        await q.query('DROP TABLE test_notes');
      }
    }
    const ds = await open({ ...migratedOptions(url!, await newSchema(), []), migrations: [...MIGRATIONS, AddNote1799999999000] });
    try {
      await ds.undoLastMigration({ transaction: 'all' });
      assert.equal(await table(ds, 'test_notes'), null);
      assert.deepEqual(await applied(ds), ALL);
      await ds.runMigrations({ transaction: 'all' });
      assert.notEqual(await table(ds, 'test_notes'), null);

      await ds.undoLastMigration({ transaction: 'all' });
      await assert.rejects(ds.undoLastMigration({ transaction: 'all' }), /cannot be reverted/);
      assert.notEqual(await table(ds, 'conversions'), null, 'the tables are still there');
      assert.deepEqual(await applied(ds), ALL);
    } finally {
      await ds.destroy();
    }
  });

  // ------------------------------------------------------------ startup as the API runs it (openDatabase)

  const connectionsNamed = async (name: string) =>
    ((await admin.query('SELECT count(*)::int AS n FROM pg_stat_activity WHERE application_name = $1', [name])) as { n: number }[])[0].n;
  const lockIsFree = async () => {
    const [{ ok }] = (await admin.query('SELECT pg_try_advisory_lock($1) AS ok', [MIGRATION_LOCK])) as { ok: boolean }[];
    if (ok) await admin.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK]);
    return ok;
  };

  test('a failing migration stops startup at once, changes nothing, frees the lock and closes every connection; it is not retried', async () => {
    class Broken1799999999999 implements MigrationInterface {
      name = 'Broken1799999999999';
      async up(q: QueryRunner) {
        await q.query('CREATE TABLE broken_half_done (id int)');
        await q.query('SELECT definitely_not_a_function()');
      }
      async down() {}
    }
    const schema = await newSchema();
    const name = `gd1-${schema}`;
    const options = { ...migratedOptions(url!, schema, ALL_ENTITIES, { application_name: name }), migrations: [...MIGRATIONS, Broken1799999999999] };
    const failure = await openDatabase(options).then(() => null, (e: unknown) => e);
    assert.ok(failure instanceof DatabasePreparationError, String(failure));
    assert.match((failure as Error).message, /definitely_not_a_function/);
    assert.equal(retryDatabaseError(failure), false, 'Nest must not retry it');
    assert.equal(retryDatabaseError(new Error('connect ECONNREFUSED')), true, 'a database not up yet is still retried');
    assert.equal(await connectionsNamed(name), 0, 'the pool was closed');
    assert.equal(await lockIsFree(), true, 'the lock was released');
    // One transaction: nothing of the failed run stayed. (TypeORM creates its bookkeeping table before the transaction
    // starts, so that table may exist, but it records nothing.)
    assert.equal((await admin.query(`SELECT to_regclass('"${schema}".broken_half_done') AS t`))[0].t, null);
    assert.equal((await admin.query(`SELECT to_regclass('"${schema}".conversions') AS t`))[0].t, null, 'not even the baseline');
    assert.equal((await admin.query(`SELECT count(*)::int AS n FROM "${schema}".migrations`))[0].n, 0);
  });

  test('when releasing the lock fails, its connection is discarded, so the lock is not left held on a pooled connection', async () => {
    const ds = await open({ ...migratedOptions(url!, await newSchema(), ALL_ENTITIES), migrationsRun: false });
    const createQueryRunner = ds.createQueryRunner.bind(ds);
    // The unlock statement fails as it would on a broken connection; everything else behaves normally.
    ds.createQueryRunner = (...args) => {
      const runner = createQueryRunner(...args);
      const query = runner.query.bind(runner);
      runner.query = ((sql: string, ...rest: unknown[]) =>
        sql.includes('pg_advisory_unlock') ? Promise.reject(new Error('connection broken')) : (query as (...a: unknown[]) => Promise<unknown>)(sql, ...rest)) as typeof runner.query;
      return runner;
    };
    try {
      await prepareDatabase(ds);
      assert.deepEqual(await applied(ds), ALL, 'the work itself succeeded');
      assert.equal(await lockIsFree(), true, 'the lock was freed with its discarded connection');
    } finally {
      await ds.destroy();
    }
  });

  test('startup waits for another holder of the lock, then gives up with a clear error', async () => {
    const holder = admin.createQueryRunner();
    await holder.connect();
    await holder.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK]);
    try {
      const started = Date.now();
      const failure = await openDatabase(migratedOptions(url!, await newSchema(), ALL_ENTITIES), { lockWaitMs: 1500 }).then(() => null, (e: unknown) => e);
      assert.ok(failure instanceof DatabasePreparationError);
      assert.match((failure as Error).message, /migration lock/);
      assert.ok(Date.now() - started >= 1400, 'it waited before giving up');
    } finally {
      await holder.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK]);
      await holder.release();
    }
  });
});
