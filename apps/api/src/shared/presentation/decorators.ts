import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';
import type { Requester, UserRequester } from '../application/requester.js';

export const ACCESS = 'agg:access';
/**
 * Who may call a route. Every controller (or handler) must declare one: the global guard refuses a route without
 * it, so a new endpoint can never become public by omission.
 * - `guest`: anyone, signed in or not (the requester may be a guest);
 * - `user`: a signed-in account;
 * - `admin`: an administrator;
 * - `webhook`: payment providers; no requester, the handler verifies the provider's signature itself.
 */
export type AccessLevel = 'guest' | 'user' | 'admin' | 'webhook';
export const Access = (level: AccessLevel) => SetMetadata(ACCESS, level);

export const MVP = 'agg:mvp';
/**
 * GD-3: marks a route that belongs to the MVP. With APP_MODE=mvp (the default) the global guard answers 404 for
 * every route without it, so a new endpoint stays closed in the MVP until it is opted in. It only narrows: the
 * route still needs its `@Access` level. Put it on the handler, or on a controller whose every route is MVP.
 */
export const Mvp = () => SetMetadata(MVP, true);

/** Injects the requester (set by the guard). */
export const CurrentRequester = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): Requester => ctx.switchToHttp().getRequest().requester,
);

/** Injects the signed-in requester; only on `user`/`admin` routes. */
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): UserRequester => ctx.switchToHttp().getRequest().requester,
);

/** Multer decodes multipart file names as latin1; restore UTF-8 (Vietnamese names). */
export const utf8Name = (name: string): string => Buffer.from(name, 'latin1').toString('utf8');
