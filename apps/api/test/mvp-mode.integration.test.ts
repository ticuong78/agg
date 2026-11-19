import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';
import type { INestApplication } from '@nestjs/common';
import { ACCESS_KEY_HEADER, VISITOR_HEADER, type ConversionDto, type CreateConversionResponse, type ExportFormatInfo } from '@agg/contracts';
import { call, fromDist, liveRoutes, startApi } from './support/api-app.js';
import { throwawayDatabase } from './support/throwaway.js';

/** The routes the MVP opens; the same list as mvp-mode.test.ts (GD-3). */
const MVP_ROUTES = new Set([
  'GET /health', 'GET /conversions/formats', 'POST /conversions', 'POST /conversions/text', 'GET /conversions/:id',
  'DELETE /conversions/:id', 'PATCH /conversions/:id/settings', 'PUT /conversions/:id/order',
  'PATCH /conversions/:id/problems/:problemId', 'DELETE /conversions/:id/problems/:problemId',
  'GET /conversions/:id/export/:format',
]);

/** A short synthetic exam, no personal data. */
const EXAM = [
  'Bài 1. Tổng hai số (TONG.INP, TONG.OUT)',
  'Cho hai số nguyên a và b. Hãy tính a + b.',
  'Dữ liệu vào: một dòng gồm hai số nguyên a, b (|a|, |b| ≤ 10^9).',
  'Kết quả: một số nguyên là a + b.',
  'Ví dụ:',
  'TONG.INP',
  '1 2',
  'TONG.OUT',
  '3',
].join('\n');

const { url, skip } = throwawayDatabase();

describe('MVP mode over HTTP (GD-3)', { skip }, () => {
  let app: INestApplication;
  let base: string;
  const visitor = randomUUID();

  before(async () => {
    // A key set by mistake must not switch AI on in the MVP; generated per run, never a literal.
    ({ app, base } = await startApi(url!, { APP_MODE: 'mvp', ANTHROPIC_API_KEY: `test-${randomBytes(16).toString('hex')}` }));
  });
  after(async () => {
    await app?.close();
  });

  test('every route the API exposes: the MVP ones answer, all others are closed with 404 feature.off', async () => {
    const routes = liveRoutes(app);
    assert.ok(routes.length >= 46, `found only ${routes.length} routes`);
    const wrong: string[] = [];
    for (const route of routes) {
      const { status, code } = await call(base, route);
      const closed = status === 404 && code === 'feature.off';
      // An open route must really answer: its own validation or not-found, never a refusal or a crash.
      const answered = !closed && status !== 401 && status !== 403 && status < 500;
      if (MVP_ROUTES.has(route.name) ? !answered : !closed) wrong.push(`${route.name}: ${status} ${code}`);
    }
    assert.deepEqual(wrong, []);
    assert.deepEqual(routes.filter((r) => MVP_ROUTES.has(r.name)).map((r) => r.name).sort(), [...MVP_ROUTES].sort());
  });

  test('AI is off even with a key', async () => {
    // The class from dist/, the one the running app registered.
    const { ClaudeClient } = await fromDist<{ ClaudeClient: new (...args: never[]) => { enabled: boolean } }>('shared/infrastructure/claude.js');
    assert.equal(app.get(ClaudeClient).enabled, false);
  });

  test('only the Themis contest is offered', async () => {
    const formats = (await (await fetch(`${base}/conversions/formats`)).json()) as ExportFormatInfo[];
    assert.deepEqual(formats.map((f) => f.format), ['contest']);
  });

  test('a guest pastes an exam, opens it and downloads a .contest; other formats are closed', async () => {
    const headers = { [VISITOR_HEADER]: visitor, 'Content-Type': 'application/json' };
    const created = await fetch(`${base}/conversions/text`, { method: 'POST', headers, body: JSON.stringify({ text: EXAM }) });
    assert.equal(created.status, 201, await created.clone().text());
    const { conversion, accessKey } = (await created.json()) as CreateConversionResponse;
    assert.ok(accessKey, 'a guest gets an access key');
    const own = { [VISITOR_HEADER]: visitor, [ACCESS_KEY_HEADER]: accessKey };

    let current: ConversionDto = conversion;
    for (let i = 0; i < 50 && current.status === 'PROCESSING'; i++) {
      await new Promise((r) => setTimeout(r, 200));
      current = (await (await fetch(`${base}/conversions/${conversion.id}`, { headers: own })).json()) as ConversionDto;
    }
    assert.equal(current.status, 'READY', current.failure ?? '');
    assert.equal(current.engine, 'BASIC', 'the rule-based reader, not AI');

    const contest = await fetch(`${base}/conversions/${conversion.id}/export/contest`, { headers: own });
    assert.equal(contest.status, 200, await contest.clone().text());
    assert.match(contest.headers.get('content-disposition') ?? '', /\.contest/);
    assert.ok((await contest.arrayBuffer()).byteLength > 0);

    for (const format of ['docx', 'doc', 'pdf', 'md']) {
      const { status, code } = await call(base, { verb: 'GET', path: `/conversions/${conversion.id}/export/${format}`, name: format });
      assert.deepEqual({ status, code }, { status: 404, code: 'feature.off' }, format);
    }
    const unknown = await call(base, { verb: 'GET', path: `/conversions/${conversion.id}/export/xyz`, name: 'xyz' });
    assert.equal(unknown.code, 'export.unknown_format');

    // Leave the shared throwaway schema as found.
    const removed = await fetch(`${base}/conversions/${conversion.id}`, { method: 'DELETE', headers: own });
    assert.equal(removed.status, 204);
  });
});
