# ADR 0003: MVP mode is an allowlist, on by default

Date: 2026-11-19
Status: accepted (decision owner: Htet Oo Naing; implemented in `docs/specs/GD-3-mvp-off-switch.md`)

## Context

The brief (decisions of 16 November) narrows the product to one guest path: upload or paste, review, export to Themis. It asks for "one off-switch for everything outside the MVP". The code already has accounts, billing, payment webhooks, growth, rewards, admin, AI and Word/PDF/Markdown exports. That makes 46 API routes, 35 of them outside the MVP, plus their pages.

The switch could list what to close (a denylist) or what to keep open (an allowlist). The MVP adds routes and pages in GD-5 to GD-7. Under a denylist, any route added without thought would be open in the MVP.

## Decision

- **One setting, `APP_MODE=mvp|full`.** Unset means `mvp`, and any other value stops startup, so forgetting or mistyping it can never open the full product.
- **An allowlist in the API:** routes join the MVP with `@Mvp()`. In MVP mode the global `RequestGuard` answers 404 `feature.off` for every other route. The `@Access` check runs first and still applies, so `@Mvp()` only narrows.
- **404, not 403.** The code `feature.off` still tells a caller that the route exists, unlike a path with no route at all. This is accepted: the frontend code, which names every route, is public anyway.
- **Every caller is a guest in MVP mode.** The guard doesn't check sign-in tokens, so a token issued before the switch cannot bring back account limits or retention.
- **Inside open routes, the MVP narrows behaviour where the route alone can't:** exports offer only `contest` (`MvpExportFormats` in `@agg/contracts`), and `ClaudeClient` is disabled even with a key.
- **The web reads `NEXT_PUBLIC_APP_MODE`,** with anything but `full` meaning `mvp`. Its Proxy (`proxy.ts`, Next 16's name for Middleware) answers 404 for pages outside the MVP, and components stop calling closed routes. The API stays the authority; the web only mirrors it.

## Consequences

- **A new route is closed in the MVP until someone adds `@Mvp()`.** That is a visible product decision: `mvp-mode.test.ts` pins the list of MVP routes, and `mvp-mode.integration.test.ts` and `full-mode.integration.test.ts` call every live route over HTTP, one mode each.
- **The non-MVP code stays and still compiles and tests in full mode,** so returning to it after the pilot is a setting, not a revert.
- **Two settings must agree.** If they don't, the API wins (fail closed); DEPLOY says to set them together.
- **One switch, not per area.** Splitting it later (for example accounts on, billing off) means replacing the boolean `@Mvp()` with a named feature. The allowlist shape stays the same.
- **Background jobs in closed contexts still run.** They find nothing to do while their routes are closed. Anonymous product events (conversion completed, export downloaded, with no visitor or user id) are still recorded, as before GD-3.
- **Route tests boot the compiled app (`dist/`).** tsx emits no decorator metadata, which Nest's injection needs, so `test:integration` runs `nest build` first.
