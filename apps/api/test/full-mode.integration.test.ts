import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { INestApplication } from '@nestjs/common';
import type { ExportFormatInfo } from '@agg/contracts';
import { call, liveRoutes, startApi } from './support/api-app.js';
import { throwawayDatabase } from './support/throwaway.js';

const { url, skip } = throwawayDatabase();

// GD-3: with APP_MODE=full the off-switch is invisible; today's behaviour is unchanged. Its own file, because the
// configuration is read once per process (see support/api-app.ts).
describe('Full mode over HTTP (GD-3)', { skip }, () => {
  let app: INestApplication;
  let base: string;

  before(async () => {
    ({ app, base } = await startApi(url!, { APP_MODE: 'full' }));
  });
  after(async () => {
    await app?.close();
  });

  test('no route the API exposes is closed', async () => {
    const routes = liveRoutes(app);
    assert.ok(routes.length >= 46, `found only ${routes.length} routes`);
    const wrong: string[] = [];
    for (const route of routes) {
      const { status, code } = await call(base, route);
      // Closed is the bug this test looks for; a crash would hide it, so it counts too.
      if (code === 'feature.off' || status >= 500) wrong.push(`${route.name}: ${status} ${code}`);
    }
    assert.deepEqual(wrong, []);
  });

  test('every export format is offered again', async () => {
    const formats = (await (await fetch(`${base}/conversions/formats`)).json()) as ExportFormatInfo[];
    assert.deepEqual(formats.map((f) => f.format).sort(), ['contest', 'doc', 'docx', 'md', 'pdf']);
  });
});
