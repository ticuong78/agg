import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { describe, test } from 'node:test';
import type { ExecutionContext } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import type { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { HealthController } from '../src/health.controller.js';
import { BillingController, PaymentWebhooksController, WorkspaceController } from '../src/modules/billing/presentation/billing.controllers.js';
import { ConversionsController } from '../src/modules/conversion/presentation/conversions.controller.js';
import { AdminGrowthController, GrowthController, RewardsController } from '../src/modules/growth/presentation/growth.controllers.js';
import type { Authenticator } from '../src/modules/identity/application/authenticator.js';
import { AuthController } from '../src/modules/identity/presentation/auth.controller.js';
import { RequestGuard } from '../src/modules/identity/presentation/request.guard.js';
import { DomainError } from '../src/shared/domain/domain-error.js';
import { MVP } from '../src/shared/presentation/decorators.js';

// GD-3: the MVP off-switch. The guard is exercised directly with the real controllers' metadata, no database.

const CONTROLLERS = [
  HealthController, ConversionsController, AuthController, GrowthController, RewardsController, AdminGrowthController,
  BillingController, PaymentWebhooksController, WorkspaceController,
];
const VERBS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'ALL', 'OPTIONS', 'HEAD'];

interface Route { name: string; controller: Function; handler: Function }

/** Every route of the given controllers, named like `GET /conversions/:id`. */
function routes(): Route[] {
  return CONTROLLERS.flatMap((controller) => {
    const base = String(Reflect.getMetadata(PATH_METADATA, controller) ?? '');
    const proto = (controller as unknown as { prototype: Record<string, unknown> }).prototype;
    return Object.getOwnPropertyNames(proto)
      .filter((key) => key !== 'constructor') // the class itself carries the controller's path
      .map((key) => proto[key])
      .filter((fn): fn is Function => typeof fn === 'function' && Reflect.hasMetadata(PATH_METADATA, fn))
      .map((handler) => {
        const path = String(Reflect.getMetadata(PATH_METADATA, handler));
        const verb = VERBS[Reflect.getMetadata(METHOD_METADATA, handler) as number];
        const full = `/${[base, path].filter((p) => p && p !== '/').join('/')}`;
        return { name: `${verb} ${full}`, controller, handler };
      });
  });
}

const isMvp = (r: Route) => Boolean(Reflect.getMetadata(MVP, r.handler) ?? Reflect.getMetadata(MVP, r.controller));

/** The routes the MVP opens (brief section 2). Changing this list is a product decision: update the GD spec too. */
const EXPECTED_MVP = [
  'GET /health',
  'GET /conversions/formats',
  'POST /conversions',
  'POST /conversions/text',
  'GET /conversions/:id',
  'DELETE /conversions/:id',
  'PATCH /conversions/:id/settings',
  'PUT /conversions/:id/order',
  'PATCH /conversions/:id/problems/:problemId',
  'DELETE /conversions/:id/problems/:problemId',
  'GET /conversions/:id/export/:format',
].sort();

function guard(mode: string | undefined): RequestGuard {
  const settings: Record<string, string | undefined> = { APP_MODE: mode, JWT_SECRET: randomBytes(32).toString('hex') };
  const config = { get: (k: string) => settings[k], getOrThrow: (k: string) => settings[k] } as unknown as ConfigService;
  const authenticator = { authenticate: async () => null } as unknown as Authenticator;
  return new RequestGuard(new Reflector(), authenticator, config);
}

function context(route: Route): ExecutionContext {
  const request = { headers: {}, ip: '127.0.0.1' };
  return {
    getHandler: () => route.handler,
    getClass: () => route.controller,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

/** 'open' (passed), 'closed' (404 feature.off), or the code of any other refusal (sign-in needed, and so on). */
async function outcome(g: RequestGuard, route: Route): Promise<string> {
  try {
    await g.canActivate(context(route));
    return 'open';
  } catch (error) {
    if (error instanceof DomainError && error.kind === 'not_found' && error.code === 'feature.off') return 'closed';
    if (error instanceof DomainError) return error.code;
    throw error;
  }
}

describe('MVP mode (GD-3)', () => {
  const all = routes();

  test('the controllers expose the 46 routes the spec counted', () => {
    assert.equal(all.length, 46, all.map((r) => r.name).join('\n'));
  });

  test('exactly the agreed routes are marked @Mvp()', () => {
    assert.deepEqual(all.filter(isMvp).map((r) => r.name).sort(), EXPECTED_MVP);
  });

  for (const mode of [undefined, 'mvp', ' MVP ']) {
    test(`APP_MODE=${JSON.stringify(mode)}: MVP routes pass to their access check, every other route is closed`, async () => {
      const g = guard(mode);
      for (const route of all) {
        const result = await outcome(g, route);
        if (isMvp(route)) assert.equal(result, 'open', route.name);
        else assert.equal(result, 'closed', route.name);
      }
    });
  }

  test('APP_MODE=full: no route is closed; access levels apply as before', async () => {
    const g = guard('full');
    const results = new Map<string, string>();
    for (const route of all) results.set(route.name, await outcome(g, route));
    assert.ok(![...results.values()].includes('closed'));
    // A guest still cannot reach an account route: the off-switch never replaces @Access.
    assert.equal(results.get('GET /auth/me'), 'auth.required');
    assert.equal(results.get('GET /conversions/:id'), 'open');
  });

  test('@Mvp() only narrows: an MVP route that needs an account still asks for one', async () => {
    class Probe { handler() {} }
    const handler = Probe.prototype.handler;
    Reflect.defineMetadata('agg:access', 'user', handler);
    Reflect.defineMetadata(MVP, true, handler);
    const result = await outcome(guard('mvp'), { name: 'probe', controller: Probe, handler });
    assert.equal(result, 'auth.required');
  });

  test('a sign-in token from before the switch makes no account in MVP mode, only in full mode', async () => {
    class Probe { handler() {} }
    const handler = Probe.prototype.handler;
    Reflect.defineMetadata('agg:access', 'guest', handler);
    Reflect.defineMetadata(MVP, true, handler);
    const token = randomBytes(24).toString('hex');
    const account = { userId: randomUUID(), email: 'teacher@example.invalid', role: 'USER' };
    const requesterIn = async (mode: string) => {
      const settings: Record<string, string> = { APP_MODE: mode, JWT_SECRET: randomBytes(32).toString('hex') };
      const config = { get: (k: string) => settings[k], getOrThrow: (k: string) => settings[k] } as unknown as ConfigService;
      const authenticator = { authenticate: async (t: string) => (t === token ? account : null) } as unknown as Authenticator;
      const request: Record<string, unknown> = { headers: { authorization: `Bearer ${token}` }, ip: '127.0.0.1' };
      const ctx = {
        getHandler: () => handler, getClass: () => Probe, switchToHttp: () => ({ getRequest: () => request }),
      } as unknown as ExecutionContext;
      await new RequestGuard(new Reflector(), authenticator, config).canActivate(ctx);
      return (request.requester as { kind: string }).kind;
    };
    assert.equal(await requesterIn('mvp'), 'guest');
    assert.equal(await requesterIn('full'), 'user');
  });

  test('a route without @Access is still refused first, in both modes', async () => {
    class Bare { handler() {} }
    const route = { name: 'bare', controller: Bare, handler: Bare.prototype.handler };
    assert.equal(await outcome(guard('mvp'), route), 'auth.route_not_declared');
    assert.equal(await outcome(guard('full'), route), 'auth.route_not_declared');
  });
});
