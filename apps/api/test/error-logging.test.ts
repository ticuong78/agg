import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { Logger, type ArgumentsHost } from '@nestjs/common';
import { ApiExceptionFilter } from '../src/shared/presentation/api-exception.filter.js';

/**
 * GD-7: the privacy page says server logs hold no exam text, browser id or IP. An unexpected error (a failed query)
 * carries its parameters as properties; the filter must log its name, message and stack only.
 */
describe('unexpected errors are logged without their data (GD-7)', () => {
  test('a failed query is logged by name and message, never with its parameters', () => {
    const secret = `Bài 1. Đề bí mật ${Math.random().toString(36).slice(2)}`;
    const visitor = 'a0a0a0a0-0000-4000-8000-000000000001';
    const failure = Object.assign(new Error('unsupported Unicode escape sequence'), {
      name: 'QueryFailedError',
      query: 'UPDATE "conversions" SET "problems" = $1, "visitor_id" = $2 WHERE "id" = $3',
      parameters: [JSON.stringify([{ statement: secret }]), visitor, 'id'],
      driverError: { detail: secret },
    });

    const logged: unknown[] = [];
    const original = Logger.prototype.error;
    Logger.prototype.error = function (...args: unknown[]) { logged.push(...args); };
    let status = 0;
    try {
      const res = { status: (s: number) => { status = s; return res; }, json: () => res, setHeader: () => res };
      const host = { switchToHttp: () => ({ getResponse: () => res }) } as unknown as ArgumentsHost;
      new ApiExceptionFilter().catch(failure, host);
    } finally {
      Logger.prototype.error = original;
    }

    assert.equal(status, 500);
    assert.ok(logged.length > 0, 'something is logged');
    const text = logged.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join('\n');
    assert.match(text, /QueryFailedError: unsupported Unicode escape sequence/);
    assert.ok(!text.includes(secret), 'exam text leaked into the log');
    assert.ok(!text.includes(visitor), 'browser id leaked into the log');
    assert.ok(logged.every((a) => typeof a === 'string' || a === undefined), 'only strings are logged, never the error object');
  });
});
