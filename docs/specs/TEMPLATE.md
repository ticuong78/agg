# GD-<n>: <title>

Status: draft | approved | done
Owner: <name>
Risky area: no | yes (<which, playbook section 8>)
MVP: in | off-switch | after the pilot
Waits on: nothing | <spec id, or an input such as Cường's exams or Themis folders, with its due date>

## Outcome

One or two sentences: who gets what, and why now.

## Scope

In:
Out:

## Done when

- [ ] <observable behaviour: route, screen, test, metric>
- [ ] <...>

## Plan

Files to add or change per context, in edit order: contracts, then API (domain, application, infrastructure, presentation), then web. Dependency direction check for any new cross-context call (facade or event).

## Contexts, contracts and configuration

Contexts touched (identity, conversion, billing, growth). New or changed types in `@agg/contracts` (`api.ts`, `enums.ts`, `plans.ts`). Entities and the migration. New env variables or flags: `.env.example`, `config/environment.ts`, `docs/DEPLOY.md`. ADR to write, if the change constrains later work.

## AI (delete if not applicable; none during the MVP)

Data sent to the model (fields; anything personal and why it is needed). Before-and-after check (playbook section 6): inputs used and results.

Task, model variable, prompt location and version, zod schema, estimated cost per call and credit cost in `plans.ts`, fallback when the key is missing or the output is invalid.

## Security and data

Access level (`@Access`) on each new route, scoping of each new query (`Conversion.canBeOpenedBy`, owner, visitor), input limits, data sent outside the system. New data about a user: privacy page entry, retention period, how it is deleted (sweep; `AccountDeleted` when tied to an account).

## Tests and fixtures

API test files to add or change and the cases they cover. Fixtures (real exams with personal data removed). Browser checks for anything a teacher sees (desktop and 375 px); until the web app has tests, a recorded browser check stands in for web-only behaviour.

## Rollout and risks

Order of merges, data backfill, what to watch after deploy, how to roll back. Parser changes to port to OnlineJudge.

## Verification (filled when done)

Gate summary lines (`pnpm build:contracts && pnpm typecheck && pnpm test`), other commands run, browser checks done, and what was not checked.
