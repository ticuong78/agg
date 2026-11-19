import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { Retention } from '@agg/contracts';

/**
 * GD-7: the MVP privacy page states periods and promises from Retention (plans.ts). These tests fail when the deploy
 * files or the code that keep those promises drift, so the page cannot quietly become false. Comment lines are removed
 * first: a commented-out command must not count as one that runs.
 */
const ROOT = join(__dirname, '../../..');
const code = (path: string, comment: RegExp) =>
  readFileSync(join(ROOT, path), 'utf8').split('\n').filter((line) => !comment.test(line)).join('\n');
const shell = (path: string) => code(path, /^\s*#/);

describe('privacy page promises (GD-7)', () => {
  test('backups: counters always left out, guest sets left out unless full mode, dumps deleted after backupDays', () => {
    const script = shell('deploy/backup.sh');
    assert.match(script, /^\s*full\) EXCLUDE="--exclude-table-data=daily_usage" ;;$/m);
    assert.match(script, /^\s*mvp \| ""\) EXCLUDE="--exclude-table-data=daily_usage --exclude-table-data=conversions" ;;$/m);
    assert.match(script, /^\s*\*\) .*exit 1 ;;$/m, 'an unknown mode must stop the backup');
    assert.match(script, /^\s*\$COMPOSE exec -T postgres pg_dump -U agg -Fc \$EXCLUDE agg > /m, 'pg_dump must use $EXCLUDE');
    // -mtime +N matches files at least N+1 whole days old, so backupDays needs N = backupDays - 1.
    assert.match(script, new RegExp(`^find .* -mtime \\+${Retention.backupDays - 1} -delete$`, 'm'));
  });

  test('every production container rotates its log at the sizes the page states', () => {
    const compose = shell('deploy/docker-compose.yml');
    assert.match(compose, new RegExp(`^ {4}max-size: ${Retention.logFileMb}m$`, 'm'));
    assert.match(compose, new RegExp(`^ {4}max-file: "${Retention.logFiles}"$`, 'm'));
    const services = compose.split(/^services:\n/m)[1].split(/^\S/m)[0];
    const names = [...services.matchAll(/^ {2}([a-z][a-z0-9_-]*):\n/gm)].map((m) => m[1]);
    assert.deepEqual(names.sort(), ['api', 'caddy', 'postgres']);
    for (const name of names) {
      const block = services.split(new RegExp(`^ {2}${name}:\\n`, 'm'))[1].split(/^ {2}\S/m)[0];
      assert.match(block, /^ {4}logging: \*logging$/m, `${name} has no log rotation`);
    }
  });

  test("Caddy's logs drop the client's IP and every request header (access key, browser id)", () => {
    const caddyfile = shell('deploy/Caddyfile');
    for (const field of ['request>remote_ip', 'request>remote_port', 'request>client_ip', 'request>headers']) {
      assert.match(caddyfile, new RegExp(`^\\s*${field} delete$`, 'm'), field);
    }
    assert.match(caddyfile, /^\s*log default \{$/m, 'the filter must apply to the default logger, which the error log uses');
    assert.doesNotMatch(caddyfile, /^\s*log\s*$/m, 'no access log');
  });

  test('the cleanup jobs use the stated periods, not numbers of their own', () => {
    assert.match(code('apps/api/src/modules/growth/application/tracking.service.ts', /^\s*(\/\/|\*)/),
      /Retention\.analyticsDays \* 86_400_000/);
    assert.match(code('apps/api/src/modules/billing/application/usage.sweeper.ts', /^\s*(\/\/|\*)/),
      /Retention\.usageCounterDays - 1/);
  });
});
