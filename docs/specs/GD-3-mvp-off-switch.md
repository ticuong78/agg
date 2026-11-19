# GD-3: MVP off-switch for accounts, billing, growth and AI

Status: done (approved by Htet Oo Naing, 2026-11-19, with both recommendations: Markdown export off, `/terms` and `/data-protection` closed)
Owner: Htet Oo Naing
Risky area: yes (playbook section 8). It touches the global `RequestGuard` (identity), access to conversions and their exports, `config/environment.ts`, and the AI client.
MVP: in (brief section 2: "One off-switch for everything outside the MVP")
Waits on: nothing (GD-1 merged). GD-5, GD-6 and GD-7 build on it: each new MVP route or page opts in.

## Outcome

One setting, `APP_MODE`, puts the whole product in MVP mode, which is the default. In that mode only the guest path is reachable: upload or paste, review, then export a Themis `.contest`. Accounts, billing, growth, rewards, admin, AI and Word, PDF or Markdown exports answer 404 in the API and are absent from the web app. The pilot then sees exactly the MVP, and nothing outside it can be reached by URL.

## Scope

In:
1. **API, closed by default.** A new `@Mvp()` decorator marks the routes that belong to the MVP. When `APP_MODE=mvp`, `RequestGuard` answers 404 (`feature.off`, "Không tìm thấy trang.") for any route without it. A new route is closed in the MVP until someone opts it in, as with `@Access`.
   - Opted in: `GET /health`, and on `conversions`: `GET formats`, `POST /`, `POST text`, `GET :id`, `DELETE :id`, `PATCH :id/settings`, `PUT :id/order`, `PATCH` and `DELETE :id/problems/:problemId`, and `GET :id/export/:format`.
   - Closed: everything else (35 of the 46 routes): `auth/*`, `growth/*`, `rewards/*`, `admin/*`, `billing/*`, `billing/webhooks/*`, `workspace/*`, `GET /conversions` and `POST :id/claim` (accounts), and `rewrite` and `suggest-tests` (AI).
2. **Exports in the MVP:** `contest` only. `GET formats` lists only it, and any other format answers 404 `feature.off`. The list `MvpExportFormats` lives in `@agg/contracts`, so the API and the web share it.
3. **AI off in the MVP even with a key.** `ClaudeClient` reports itself disabled when `APP_MODE=mvp`, so a key set by mistake cannot make the upload path call Anthropic. Reading falls back to the rule-based parser, as it does today without a key.
4. **Configuration:**
   - `APP_MODE=mvp|full`, unset meaning `mvp` (closed by default); any other value stops startup.
   - `SMTP_HOST` is required in production only when `APP_MODE=full`, since sign-in e-mails exist only then.
   - The web uses `NEXT_PUBLIC_APP_MODE`, with the same default.
5. **Web in MVP mode:**
   - A `proxy.ts` (Next 16's name for Middleware; deviation 1) answers 404 for `/login`, `/account`, `/admin`, `/pricing`, `/rewards`, `/contact`, `/checkout/*`, `/terms` and `/data-protection`. The last two describe accounts, credit and AI. `/privacy` stays; GD-7 replaces it with the short MVP version.
   - No calls to closed routes:
     - `session.tsx`: no `me`, `usage` or `claim`. Guest limits come from the guest plan in `plans.ts`.
     - `tracking.tsx` and the consent banner: off.
     - `export-step.tsx`: `contest` only, and no lead form.
     - The rewrite and suggest-tests buttons: hidden.
     - The upgrade dialog: never shown.
   - No links to closed pages in the header, footer or home page.
6. **Docs:**
   - `.env.example` (API and web), `docs/DEPLOY.md`, `docs/ARCHITECTURE.md` (modes and `@Mvp`) and `README.md`.
   - `CLAUDE.md`: the test rule now covers route tests (playbook section 12), and a new route declares `@Mvp()` when it belongs to the MVP.
   - Playbook section 12: this row is done. The brief's "Missing: feature flags" is updated.
   - ADR 0003.

Out:
- Deleting or refactoring the non-MVP code: it stays, and `APP_MODE=full` restores today's behaviour.
- Background jobs in closed contexts (`tracking.service` daily cleanup, `checkout.service` order expiry). With their routes closed they find nothing to do; turning them off is not needed for the MVP.
- Per-area flags (accounts on, billing off, and so on): one switch, as the brief decided. ADR 0003 records how to split it later if needed.
- The privacy page text (GD-7), test zip import (GD-5) and feedback (GD-6).

**Decisions** (approved 2026-11-19):
1. Markdown export in the MVP: **off**. The brief keeps statement exports out, and `.contest` already carries the statements.
2. `/terms` and `/data-protection`: **closed** until rewritten. Their text promises accounts, credit and AI, which the MVP doesn't offer.

## Done when

- [x] With `APP_MODE=mvp`, every route the running API exposes is called over HTTP: the 11 MVP routes respond as before, and every other route answers 404 `feature.off`. The test enumerates the routes from the live app, so a route added later is covered automatically.
- [x] With `APP_MODE=full`, the same enumeration shows today's behaviour: no route answers `feature.off`.
- [x] In MVP mode, a guest pastes a sample exam, opens it and downloads a `.contest` (200). `docx`, `pdf` and `md` answer 404. `GET formats` returns only `contest`.
- [x] In MVP mode, with a fake `ANTHROPIC_API_KEY` generated at run time, `ClaudeClient` reports disabled and the upload uses the rule-based reader.
- [x] Startup refuses `APP_MODE=beta`. Unset means `mvp`. Production with `APP_MODE=mvp` starts without `SMTP_HOST`.
- [x] Browser, desktop and 375 px, MVP mode:
  - home, upload, review and export work;
  - each closed page shows 404;
  - no link points at a closed page;
  - the network log shows no request to a closed route.
- [x] Gate and `test:integration` pass. ADR 0003 is written.

## Plan

1. Contracts: `AppModes` and `AppMode`, plus `MvpExportFormats`, in `enums.ts`; then `pnpm build:contracts`.
2. API, shared: `@Mvp()` in `shared/presentation/decorators.ts`; `APP_MODE` in `config/environment.ts`; `ClaudeClient` off in the MVP (`shared/infrastructure/claude.ts`).
3. API, identity: the MVP check in `RequestGuard`, after the `@Access` check, so a route still needs both.
4. API, conversion: `@Mvp()` on the 10 MVP handlers; formats and export restricted in `export.service.ts`. Then `@Mvp()` on `health.controller.ts`. No changes to billing, growth or the identity controllers: they are closed by default.
5. Web: `lib/config.ts` (`APP_MODE`), `proxy.ts`, then session, tracking, header, footer, home, the export step, the editors and upgrade, each gated on the mode.
6. Docs and ADR 0003. Then `/review`, the `security-verifier` (guard, conversion access, exports), the gate, `test:integration`, and the browser check.

No new cross-context call. The guard reads the mode from `ConfigService`, which every context already uses.

## Contexts, contracts and configuration

- **Contexts:** identity (guard), conversion (controller and exports), and shared (decorator, config, Claude client). Billing and growth are not edited.
- **Contracts:** `enums.ts` (`AppModes`, `MvpExportFormats`). No `api.ts` or `plans.ts` change.
- **Database:** no entity or migration.
- **New variables:**
  - `APP_MODE` (API): in `.env.example`, `environment.ts` and DEPLOY.
  - `NEXT_PUBLIC_APP_MODE` (web): in `.env.example` and DEPLOY.

  If the two disagree, the API wins: the web can show something the API refuses, never the reverse. DEPLOY says to set them together.
- **ADR 0003:** MVP mode as an allowlist, with routes closed until marked `@Mvp()`.

## Security and data

- The 404 is enforced in the API, not only in the web app, so a closed feature can't be reached with curl.
- The guard keeps the `@Access` check first. `@Mvp()` only narrows, never widens: an `@Mvp()` route still needs its access level, and `Conversion.canBeOpenedBy` is untouched.
- The closed answer is 404, not 403. Its code `feature.off` still tells a caller that the route exists, which is accepted: the frontend code is public (deviation 5).
- In MVP mode every caller is a guest. The guard checks no sign-in token, so a token issued before the switch cannot bring back account limits or retention (deviation 2).
- No new data about users. MVP mode stores less: no visits, consent or leads, because the growth routes are closed and the web stops calling them. Anonymous product events (conversion completed, export downloaded, with no visitor or user id) are still recorded, as before GD-3.

## Tests and fixtures

- `apps/api/test/environment.test.ts`: `APP_MODE` default, invalid value, and SMTP required only in full mode.
- `apps/api/test/mvp-mode.test.ts` (unit, no database): the guard with a fake execution context. In each mode, an `@Mvp()` route against an unmarked one, and `@Access` still applied.
- `apps/api/test/mvp-mode.integration.test.ts`: boots `AppModule` on the throwaway database, `listen(0)`, and plain `fetch`, so no new dependency. Routes are listed from Nest's `ModulesContainer` (deviation 4), and every one is called. Full mode is in its own file, `full-mode.integration.test.ts`, because the configuration is read once per process. It also runs the guest happy path, the export formats, and the AI client with a generated fake key.
- Fixtures: a short synthetic exam text, without personal data.
- Browser checks, recorded in Verification: desktop and 375 px, MVP mode, both apps running locally.

## Rollout and risks

1. Merge. Production becomes MVP unless `APP_MODE=full` is set; whether anything is deployed today is still Htet's open question.
2. Set `APP_MODE` and `NEXT_PUBLIC_APP_MODE` together in the deploy (DEPLOY.md).
3. **No public MVP before GD-7.** `/privacy` stays open but still describes accounts, payments, credit and exams sent to Anthropic: more processing than the MVP does, and it contradicts the home page's "Không dùng AI" (no AI). It is recorded in DEPLOY's pre-launch checklist; GD-7 replaces the page.
- **Risk:** a web component still calls a closed route, showing console errors or a broken widget. Mitigation: the network-log check, and failures handled quietly where calls are best-effort.
- **Risk:** a future MVP route forgets `@Mvp()`. That is fail-closed and visible at once (404); the integration test lists the MVP routes explicitly.
- **Rollback:** set `APP_MODE=full`, or revert.
- No parser change.

## Deviations

All five were found in implementation or review. Htet approved them with "Yes, fix them" (19 Nov) before they were made, except deviation 3, which is a test mechanism, not scope.

1. **`proxy.ts`, not `middleware.ts`.** Next 16.4.6, the version this app uses, renamed the Middleware convention to Proxy (`node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`). The behaviour is the same.
2. **Every caller is a guest in MVP mode.** Both review agents found that a sign-in token issued before the switch still gave account limits and retention on the open routes. The guard now skips token checks in MVP mode, and the web stops sending the token. A unit test covers both modes.
3. **Integration tests boot the compiled app.** tsx emits no decorator metadata, so Nest could not inject `ConfigService`. `test:integration` now runs `nest build` first, and the tests load `dist/`. No new dependency.
4. **`ModulesContainer` instead of `DiscoveryService`** to list the live routes. It needs no extra module in the app.
5. **The 404 wording.** The spec said a closed area "doesn't reveal it exists". The code `feature.off` does tell a caller the route exists. This is accepted, because the frontend code names every route anyway. The spec, the guard comment and ADR 0003 now say so.

## Measures (filled when done)

- Elapsed: about 40 minutes from approval (19 Nov 11:10 UTC) to the first report of done (about 11:44 UTC), plus about 10 minutes of fixes after review. Merge is still to come.
- Review findings before reporting done, after one round:
  - `reviewer`: 2 blocking, 7 should fix and 11 nits.
  - `security-verifier`: no High or Medium; 4 Low and 2 test gaps.
  - All fixed or recorded, except the API's own sign-in and AI wording on limit errors. The web rewrites that wording, and the rest is left for GD-7.
- Escaped defects: none yet. The browser check before the review caught 2 texts on the export step: "AI gợi ý", and an empty "other formats" heading.
- Htet's attention: about 10 minutes, estimated (approval, one fix decision).
- Deviations: 5 (above).
- Rule breaches: none.

## Verification (filled when done)

- **Gate:** `build:contracts` OK; typecheck Done ×3; `pnpm test` 48/48. The 13 new tests are 9 guard tests and 4 `APP_MODE` environment tests.
- **Integration:** `pnpm test:integration` 14/14, on the throwaway Postgres 55433. The 6 new tests boot the compiled app over HTTP:
  - MVP mode: every live route was called. The 11 MVP routes answered with no 401, 403 or 5xx; the other 35 answered 404 `feature.off`.
  - Full mode: at least 46 routes were found, none closed and none 5xx; all 5 export formats are offered.
  - A guest pasted an exam, read it with the rule-based reader, downloaded a `.contest` (200), then deleted it.
  - `docx`, `doc`, `pdf` and `md` answered 404 `feature.off`; `xyz` answered 400.
  - `ClaudeClient` was disabled with a generated fake key.
- **Browser** (MVP mode; API on 4100 and web on 3100 locally, because OnlineJudge held 3000 and 4000):
  - Desktop: home shows one nav link and no sign-in, and its text makes no AI promise. A pasted exam went to review, which had no AI buttons, then to export, which offered `.contest` only and showed no lead form.
  - Network log: only `conversions/text`, `conversions/:id` and `conversions/formats` were called.
  - Statuses: `/` and `/privacy` 200. `/login`, `/account`, `/admin`, `/pricing`, `/rewards`, `/contact`, `/checkout/result`, `/terms` and `/data-protection` 404, again after the rename to `proxy.ts`.
  - The privacy page links only to `/` and `/privacy`.
  - With a token in browser storage, the page made no calls to closed routes and showed no sign-in link.
  - 375 px: the menu holds "Chuyển đổi" only, the links are `/`, `/privacy` and the support e-mail, and nothing scrolls sideways.
  - Console: no errors.
- **Reviews:** `reviewer` and `security-verifier`, as listed in Measures. A senior review afterwards found nothing blocking. It ran `next build` for the web app, which passed and recognised `proxy.ts`. It also swept the MVP path for sign-in, credit and AI wording; every remaining hit is in a branch the MVP never renders. One should fix: the rollout rule above (no public MVP before GD-7).
- **Not checked:**
  - Clicking the browser download: it would write into Htet's Downloads. The integration test downloads the `.contest` over HTTP instead.
  - A dropped image in MVP mode: it is labelled "chưa hỗ trợ ảnh" (images not supported yet), checked by reading the code. The API refuses images with `feature.images`, which the web rewrites.
  - A real deploy: whether anything is deployed today is still Htet's open question.
