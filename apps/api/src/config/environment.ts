import { Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';

export type Env = Record<string, unknown>;

export const MIN_SECRET_LENGTH = 32;
const PLACEHOLDER = /change[-_ ]?me|your[-_ ]?secret|secret[-_ ]?key|^secret$|^password$|^(.)\1*$/i;

const text = (env: Env, key: string): string => (typeof env[key] === 'string' ? (env[key] as string).trim() : '');

/**
 * Checks the configuration before anything starts. There must be no secret known in advance: in production a
 * missing or placeholder secret stops the server; in development a random one is generated for the run.
 */
export function checkEnvironment(raw: Env): { env: Env; errors: string[]; warnings: string[] } {
  const env: Env = { ...raw };
  const errors: string[] = [];
  const warnings: string[] = [];
  // Case and spaces ignored, so ' Production' cannot slip past the production-only checks (DB_SYNC, secrets, SMTP).
  const production = text(env, 'NODE_ENV').toLowerCase() === 'production';

  if (!text(env, 'DATABASE_URL')) errors.push('DATABASE_URL is required.');

  const secret = text(env, 'JWT_SECRET');
  if (!secret) {
    if (production) errors.push('JWT_SECRET is required in production (openssl rand -hex 32).');
    else {
      env.JWT_SECRET = randomBytes(32).toString('hex');
      warnings.push('JWT_SECRET is not set: using a random one, so sessions end whenever the server restarts.');
    }
  } else if (secret.length < MIN_SECRET_LENGTH || PLACEHOLDER.test(secret)) {
    errors.push(`JWT_SECRET must be a random value of at least ${MIN_SECRET_LENGTH} characters (openssl rand -hex 32).`);
  }

  if (production) {
    if (!text(env, 'SMTP_HOST')) errors.push('SMTP_HOST is required in production: sign-in codes are sent by e-mail.');
    for (const key of ['CORS_ORIGINS', 'FRONTEND_URL', 'PUBLIC_API_URL']) {
      if (!text(env, key) || /localhost|127\.0\.0\.1/.test(text(env, key))) warnings.push(`${key} points at localhost in production.`);
    }
    if (text(env, 'DB_SYNC') === 'true') {
      errors.push('DB_SYNC=true is not allowed in production: it alters tables to match the code without review and can drop a column with its data. The schema comes from the migrations, which run at startup (docs/DEPLOY.md).');
    }
    if (!text(env, 'IP_HASH_SECRET')) warnings.push('IP_HASH_SECRET is not set: addresses are hashed with JWT_SECRET (rotating it resets guest allowances).');
  }
  if (text(env, 'TRUST_PROXY') === 'true') {
    errors.push('TRUST_PROXY=true trusts X-Forwarded-For from anyone; set the number of proxies instead (e.g. TRUST_PROXY=1).');
  }
  if (!text(env, 'ANTHROPIC_API_KEY')) warnings.push('ANTHROPIC_API_KEY is not set: AI features are off, documents are read by the rule-based parser.');
  return { env, errors, warnings };
}

export function validateEnvironment(raw: Env): Env {
  const { env, errors, warnings } = checkEnvironment(raw);
  const logger = new Logger('Config');
  warnings.forEach((w) => logger.warn(w));
  if (errors.length) throw new Error(`Invalid configuration:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  return env;
}

export function parseTrustProxy(value: string | undefined): boolean | number | string {
  const v = value?.trim();
  if (!v || v === 'false') return false;
  if (/^\d+$/.test(v)) return Number(v);
  return v;
}
