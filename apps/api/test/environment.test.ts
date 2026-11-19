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

describe('Environment: APP_MODE (GD-3)', () => {
  test('unset means mvp, and a known value is accepted in any case', () => {
    assert.deepEqual(checkEnvironment(production).errors, []);
    for (const APP_MODE of ['mvp', 'full', ' Full ', 'MVP']) {
      assert.deepEqual(checkEnvironment({ ...production, APP_MODE }).errors, [], APP_MODE);
    }
  });

  test('an unknown mode stops startup instead of guessing', () => {
    const { errors } = checkEnvironment({ ...production, APP_MODE: 'beta' });
    assert.equal(errors.length, 1);
    assert.match(errors[0], /APP_MODE must be one of: mvp, full/);
  });

  test('production needs SMTP only when accounts exist (full mode)', () => {
    const { SMTP_HOST: _omitted, ...withoutSmtp } = production;
    assert.deepEqual(checkEnvironment(withoutSmtp).errors, [], 'mvp by default: no sign-in e-mails');
    assert.deepEqual(checkEnvironment({ ...withoutSmtp, APP_MODE: 'mvp' }).errors, []);
    assert.match(checkEnvironment({ ...withoutSmtp, APP_MODE: 'full' }).errors.join(), /SMTP_HOST is required in production with APP_MODE=full/);
  });

  test('mvp mode warns that AI stays off even with a key', () => {
    const { warnings } = checkEnvironment({ ...production, ANTHROPIC_API_KEY: randomBytes(16).toString('hex') });
    assert.ok(warnings.some((w) => /APP_MODE is mvp/.test(w)));
  });
});
