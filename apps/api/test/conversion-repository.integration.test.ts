import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';
import { DataSource } from 'typeorm';
import { Conversion } from '../src/modules/conversion/domain/conversion.js';
import { ConversionOrmEntity, TypeOrmConversionRepository } from '../src/modules/conversion/infrastructure/persistence.js';
import { migratedOptions } from './support/migrated-schema.js';
import { throwawayDatabase } from './support/throwaway.js';

/**
 * GD-7: a deleted set must stay deleted (the privacy page offers "Xoá bộ đề"), and text PostgreSQL cannot store must
 * not make a write fail (a failed write used to be logged with its parameters). On a migrated schema of its own.
 */
const { url, skip } = throwawayDatabase();

describe('conversion repository (GD-7)', { skip }, () => {
  let admin: DataSource;
  let ds: DataSource;
  let repo: TypeOrmConversionRepository;
  const schema = `agg_conv_${randomBytes(4).toString('hex')}`;
  const guest = () => ({ kind: 'guest' as const, visitorId: randomUUID(), ipHash: randomBytes(16).toString('hex') });

  before(async () => {
    admin = await new DataSource({ type: 'postgres', url }).initialize();
    await admin.query(`CREATE SCHEMA "${schema}"`);
    ds = await new DataSource(migratedOptions(url!, schema, [ConversionOrmEntity])).initialize();
    repo = new TypeOrmConversionRepository(ds.getRepository(ConversionOrmEntity));
  });
  after(async () => {
    await ds?.destroy();
    await admin?.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin?.destroy();
  });

  test('a save after a delete does not bring the set back', async () => {
    const { conversion } = Conversion.start({ requester: guest(), sources: [{ name: 'de.txt', kind: 'TEXT', sizeBytes: 10, pages: null }], retentionDays: 1 });
    await repo.insert(conversion);
    const loaded = await repo.findById(conversion.id);
    assert.ok(loaded, 'inserted');

    await repo.delete(conversion.id); // the guest presses "Xoá bộ đề" while a job still holds `loaded`
    await repo.save(loaded!); // the job finishes and saves
    assert.equal(await repo.findById(conversion.id), null);
  });

  test('a NUL character in a file name or exam text is removed instead of failing the write', async () => {
    const { conversion } = Conversion.start({ requester: guest(), sources: [{ name: 'de\u0000thi.txt', kind: 'TEXT', sizeBytes: 10, pages: null }], retentionDays: 1 });
    await repo.insert(conversion);
    const stored = await repo.findById(conversion.id);
    assert.equal(stored?.snapshot().sources[0].name, 'dethi.txt');
    assert.equal(stored?.settings.name, 'dethi');
    await repo.save(stored!); // an update with clean text still works
    assert.ok(await repo.findById(conversion.id));
  });
});
