import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { describe, test } from 'node:test';
import { checkEnvironment } from '../src/config/environment.js';

// Secrets are generated per run, never written in the file: a literal would look like a leaked key to secret scanners.
const production = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgres://agg:agg@db:5432/agg',
  JWT_SECRET: randomBytes(32).toString('hex'),
  IP_HASH_SECRET: randomBytes(32).toString('hex'),
  SMTP_HOST: 'smtp.example.com',
  CORS_ORIGINS: 'https://goide.example.com',
  FRONTEND_URL: 'https://goide.example.com',
  PUBLIC_API_URL: 'https://api.goide.example.com',
};

describe('Environment: DB_SYNC (GD-1)', () => {
  test('production with migrations only starts', () => {
    assert.deepEqual(checkEnvironment({ ...production, DB_SYNC: 'false' }).errors, []);
    assert.deepEqual(checkEnvironment(production).errors, []);
  });

  test('production refuses DB_SYNC=true, which would alter tables without review', () => {
    const { errors } = checkEnvironment({ ...production, DB_SYNC: 'true' });
    assert.equal(errors.length, 1);
    assert.match(errors[0], /DB_SYNC=true is not allowed in production/);
  });

  test('NODE_ENV is read without regard to case or spaces', () => {
    for (const NODE_ENV of ['Production', ' production ', 'PRODUCTION']) {
      assert.match(checkEnvironment({ ...production, NODE_ENV, DB_SYNC: 'true' }).errors.join(), /DB_SYNC=true is not allowed/, NODE_ENV);
    }
  });

  test('a local database may still use DB_SYNC=true', () => {
    const { errors } = checkEnvironment({ NODE_ENV: 'development', DATABASE_URL: 'postgres://agg:agg@127.0.0.1:5433/agg', DB_SYNC: 'true' });
    assert.deepEqual(errors, []);
  });
});
