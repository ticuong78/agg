import { createHmac } from 'node:crypto';

/**
 * Addresses are never stored as they are: a keyed hash is enough to count guest usage per network and to
 * spot abuse, and it cannot be turned back into the address. IPv6 clients are grouped by their /64.
 */
export function hashIp(ip: string | undefined, secret: string): string {
  const raw = (ip ?? 'unknown').replace(/^::ffff:/, '');
  const network = raw.includes(':') ? raw.split(':').slice(0, 4).join(':') : raw;
  return createHmac('sha256', secret).update(network).digest('hex').slice(0, 32);
}
