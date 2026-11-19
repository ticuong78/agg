import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';
import { DataSource } from 'typeorm';
import { Retention } from '@agg/contracts';
import { today } from '../src/modules/billing/application/billing.facade.js';
import { UsageSweeper } from '../src/modules/billing/application/usage.sweeper.js';
import { DailyUsageOrmEntity, TypeOrmDailyUsageRepository } from '../src/modules/billing/infrastructure/persistence.js';
import { migratedOptions } from './support/migrated-schema.js';
import { throwawayDatabase } from './support/throwaway.js';

/**
 * GD-7: allowance counters hold the browser's random id and the hashed IP; the privacy page promises they are
 * deleted after Retention.usageCounterDays. On a migrated schema of its own, dropped after.
 */
const { url, skip } = throwawayDatabase();
const DAY = 86_400_000;

describe('usage counters retention (GD-7)', { skip }, () => {
  let admin: DataSource;
  let ds: DataSource;
  const schema = `agg_usage_${randomBytes(4).toString('hex')}`;

  before(async () => {
    admin = await new DataSource({ type: 'postgres', url }).initialize();
    await admin.query(`CREATE SCHEMA "${schema}"`);
    ds = await new DataSource(migratedOptions(url!, schema, [DailyUsageOrmEntity])).initialize();
  });
  after(async () => {
    await ds?.destroy();
    await admin?.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin?.destroy();
  });

  test(`the nightly sweep keeps the last ${Retention.usageCounterDays} days of counters and deletes older ones`, async () => {
    assert.equal(Retention.usageCounterDays, 2, 'this test and the privacy page both assume two days');
    const now = new Date('2026-11-19T17:05:00Z'); // 00:05 on 20 Nov in Vietnam, when the sweep runs
    const day = (ago: number) => today(new Date(now.getTime() - ago * DAY));
    const visitor = randomUUID();
    for (const ago of [0, 1, 2, 3, 30]) {
      await ds.query('INSERT INTO daily_usage (key, day, count) VALUES ($1, $2, 1)', [`v:${visitor}`, day(ago)]);
    }

    const sweeper = new UsageSweeper(new TypeOrmDailyUsageRepository(ds, ds.getRepository(DailyUsageOrmEntity)));
    assert.equal(await sweeper.sweep(now), 3);

    const kept = (await ds.query('SELECT day FROM daily_usage ORDER BY day DESC')) as { day: string }[];
    assert.deepEqual(kept.map((r) => r.day), [day(0), day(1)]);
  });
});
