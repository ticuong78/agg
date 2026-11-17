---
name: review
description: Review the current branch's diff against agg's (GóiĐề) architecture, security, data, testing and documentation rules before opening a pull request.
---

# Review

Run on the diff against `main` (`git diff origin/main...HEAD`, plus uncommitted and untracked files when the work is not committed). Produce a list of findings, each with file and line, severity (blocking, should fix, nit) and a concrete fix. Say "nothing blocking" explicitly when that is the result.

Check, in this order:

1. Spec: a spec exists in `docs/specs/`, its "done when" items are covered by the diff, and the diff does not do more than the spec or step outside the MVP scope (`docs/session-brief.md` section 2).
2. Boundaries: new imports respect the layer order (domain, application, infrastructure, presentation; domain imports no NestJS, TypeORM or infrastructure) and the context direction in `CLAUDE.md`; cross-context calls go through facades behind a local port, or events.
3. Contracts and docs: new DTOs and enums live in `@agg/contracts`; limits, prices and credits only in `plans.ts`; no duplicated shapes; `docs/ARCHITECTURE.md`, `docs/THEMIS-FORMAT.md`, `docs/DEPLOY.md` and `README.md` updated for any route, format, configuration or behaviour change; entity changes come with a migration (once GD-1 has landed).
4. Security: `@Access(...)` on every route, at the narrowest level; routes and pages outside the MVP closed by the MVP switch (once GD-3 has landed); every load by id checked with `Conversion.canBeOpenedBy` or the owner, answering 404; class-validator on every new field; upload and archive limits; errors as `DomainError` with a Vietnamese `message` and a stable English `code`, and `paymentRequired` with `details.action` for limits, credits and locked features; no secrets, sign-in codes, tokens, access keys or full emails in logs.
5. Data: uploaded originals never stored; new data about a user on the privacy page with a retention period, deleted by a retention sweep, and in `AccountDeleted` when tied to an account; fixtures free of personal data.
6. AI: none added during the MVP; every route works with no `ANTHROPIC_API_KEY`. After the MVP, playbook sections 4 to 6 apply (model from `.env`, versioned prompt with delimited user content, zod, fallback, credit cost, before-and-after check).
7. Tests: new API behaviour has tests in `apps/api/test/`; web-only behaviour has a recorded browser check until the web app has tests; a bug fix has a regression test; a parser change keeps every exam fixture passing; `pnpm build:contracts && pnpm typecheck && pnpm test` were run (ask for the output if not shown); a browser check for anything a teacher sees.
8. Web: calls go through `apps/web/src/lib/api.ts`; no business rule enforced only in the UI; user-facing text in Vietnamese.
9. Hygiene: branch named `feat/GD-<n>-<slug>`, `fix/GD-<n>-<slug>` or `chore/<slug>`; commit messages follow Conventional Commits with a scope from `commitlint.config.cjs`; the spec's Verification section filled; parser changes noted for porting to OnlineJudge.

Then launch the `reviewer` agent on the same diff and merge its findings with yours, removing duplicates. Do not fix anything during the review; report first.
