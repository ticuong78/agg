/**
 * Integration suites run only against the throwaway database (docker-compose.test.yml, port 55433), never against
 * the development database (docker-compose.yml, port 5433), whose data they would mix with. In CI the database is
 * itself throwaway, so the development port is accepted there.
 *   pnpm infra:test:up   then   pnpm test:integration
 */
const DEV_PORT = '5433';

export function throwawayDatabase(): { url: string | undefined; skip: string | false } {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return { url, skip: 'set TEST_DATABASE_URL (pnpm infra:test:up, then pnpm test:integration) to run these tests' };
  const parsed = new URL(url);
  // pg lets query parameters and PGPORT override the URL, so the port checked must be the one pg will use.
  if (parsed.searchParams.has('port') || parsed.searchParams.has('host')) {
    throw new Error('TEST_DATABASE_URL must not set host or port as query parameters; put them in the URL itself.');
  }
  const port = parsed.port || process.env.PGPORT || '5432';
  if (port === DEV_PORT && !process.env.CI) {
    throw new Error(`TEST_DATABASE_URL points at the development database (port ${port}). ` +
      'Use the throwaway one instead: pnpm infra:test:up, then pnpm test:integration.');
  }
  return { url, skip: false };
}
