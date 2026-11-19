import 'reflect-metadata';
import { randomBytes, randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import { ModulesContainer, NestFactory } from '@nestjs/core';
import { VISITOR_HEADER } from '@agg/contracts';

/**
 * Loads a module of the compiled API (`nest build`, run by `test:integration`). Nest injects constructor arguments
 * by their emitted type metadata, which tsc writes and tsx does not, so the whole app is booted from dist/.
 */
export async function fromDist<T>(path: string): Promise<T> {
  return (await import(`../../dist/${path}`)) as T;
}

/**
 * The real API over HTTP, for integration tests (GD-3): the same AppModule, prefix, pipes and error filter as
 * main.ts, on a random port, against the throwaway database. The configuration is read once per process, so each
 * mode gets its own test file (node --test runs every file in its own process).
 */
export async function startApi(databaseUrl: string, env: Record<string, string>): Promise<{ app: INestApplication; base: string }> {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL: databaseUrl,
    DB_SYNC: 'false',
    // Generated per run: a literal would look like a leaked key to secret scanners.
    JWT_SECRET: randomBytes(32).toString('hex'),
    ...env,
  });
  const { AppModule } = await fromDist<{ AppModule: new () => unknown }>('app.module.js');
  const { ApiExceptionFilter } = await fromDist<{ ApiExceptionFilter: new () => object }>('shared/presentation/api-exception.filter.js');
  // abortOnError: false, so a start-up error fails the test with its message instead of exiting the process.
  const app = await NestFactory.create(AppModule, { logger: false, rawBody: true, abortOnError: false });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new ApiExceptionFilter() as never);
  await app.listen(0, '127.0.0.1');
  const { port } = app.getHttpServer().address() as AddressInfo;
  return { app, base: `http://127.0.0.1:${port}/api` };
}

const VERBS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'ALL', 'OPTIONS', 'HEAD'];

export interface LiveRoute { verb: string; path: string; name: string }

/** Every route the running app exposes, read from its controllers: a route added later is covered automatically. */
export function liveRoutes(app: INestApplication): LiveRoute[] {
  const routes: LiveRoute[] = [];
  for (const module of app.get(ModulesContainer).values()) {
    for (const wrapper of module.controllers.values()) {
      const controller = wrapper.metatype as Function | null;
      if (!controller) continue;
      const base = String(Reflect.getMetadata(PATH_METADATA, controller) ?? '');
      const proto = (controller as { prototype: Record<string, unknown> }).prototype;
      for (const key of Object.getOwnPropertyNames(proto)) {
        const handler = proto[key];
        if (key === 'constructor' || typeof handler !== 'function' || !Reflect.hasMetadata(PATH_METADATA, handler)) continue;
        const verb = VERBS[Reflect.getMetadata(METHOD_METADATA, handler) as number];
        const path = `/${[base, String(Reflect.getMetadata(PATH_METADATA, handler))].filter((p) => p && p !== '/').join('/')}`;
        routes.push({ verb, path, name: `${verb} ${path}` });
      }
    }
  }
  return routes;
}

/** Calls a route with harmless placeholder parameters and an empty body; returns the status and the error code. */
export async function call(base: string, route: LiveRoute): Promise<{ status: number; code: string | null }> {
  const path = route.path
    .replace(':format', 'contest')
    .replace(':provider', 'stripe')
    .replace(':email', 'nobody@example.invalid')
    .replace(/:[A-Za-z]+/g, () => randomUUID());
  const hasBody = !['GET', 'DELETE', 'HEAD'].includes(route.verb);
  const response = await fetch(`${base}${path}`, {
    method: route.verb,
    headers: { [VISITOR_HEADER]: randomUUID(), ...(hasBody ? { 'Content-Type': 'application/json' } : {}) },
    body: hasBody ? '{}' : undefined,
  });
  const text = await response.text();
  let code: string | null = null;
  try { code = (JSON.parse(text) as { code?: string }).code ?? null; } catch { /* not JSON: a file or an empty body */ }
  return { status: response.status, code };
}
