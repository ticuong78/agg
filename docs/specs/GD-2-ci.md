# GD-2: CI on every pull request and push to main

Status: done (approved by Htet Oo Naing 2026-11-17; first green run on PR #3, 2026-11-19)
Owner: Htet Oo Naing
Risky area: yes. **This changes CI** (`.github/workflows/**`, playbook section 8), and the playbook's enforcement labels change with it.
MVP: in (prerequisite: every later step relies on the gate running remotely, not only on a hook that can be skipped)
Waits on: nothing (GD-1 merged)

## Outcome

Every pull request and every push to `main` runs the same gate as the pre-push hook, plus the migration drift guard from GD-1 against a real Postgres, and checks commit messages. A red check is visible on the PR before Htet merges, so a skipped hook (`--no-verify`, `HUSKY=0`, a GUI client) or an entity change without a migration no longer reaches `main` unnoticed.

## Scope

In:
- **`.github/workflows/ci.yml`**, one job `verify` on `ubuntu-24.04`, triggered by `pull_request` (any branch) and `push` to `main`:
  1. checkout (full history on PRs, for commitlint);
  2. pnpm from `packageManager` (`pnpm@12.17.0`), Node 24, the pnpm store cached;
  3. `pnpm install --frozen-lockfile` with `HUSKY=0`, so the `prepare` script does not install hooks;
  4. `pnpm build:contracts`, `pnpm typecheck`, `pnpm test`;
  5. `pnpm test:integration` against a Postgres 17 service on port 55433, the same URL the root script already uses, so CI and a laptop run one command;
  6. the migration check from the command line: `migration:run`, then `migration:check` on the same service database;
  7. PRs only: commitlint on every commit in the PR (`--from` base `--to` head), and on the PR title, because squash merge makes the title the commit on `main` (once the squash default message is "Pull request title", an admin setting in the playbook's section 12). The title is passed through an environment variable, never pasted into the shell script, so a crafted title cannot run commands.
- **Pinned actions:** every `uses:` is pinned to a full commit SHA, with the release tag in a comment (`actions/checkout`, `pnpm/action-setup`, `actions/setup-node`). Tags can move; SHAs cannot.
- **Least privilege:** `permissions: contents: read` for the workflow; no secrets are used; `pull_request` only, never `pull_request_target`, because the repository is public and takes forks.
- **Housekeeping:** `concurrency` cancels a superseded run on the same PR; each commit on `main` gets its own group, so none is dropped from the queue; `timeout-minutes: 15`; the PR title is re-checked when it is edited.
- **Docs:** the playbook (CI rows move from Planned to `CI`; definition of done; section 12; version 1.1; the repository admin named as the owner of `ticuong78/agg`, needed for the branch-protection row), `CLAUDE.md` (one line: CI must be green before merge), `README.md` (a CI badge is not needed; one sentence on what CI runs), ADR not needed (follows ADR 0002 and the playbook).

Out:
- **Making the check required** (branch protection on `main`): a repository setting for the admin, listed in the playbook's section 12 with the steps. GD-2 makes the check exist; protecting `main` is a separate decision.
- Building the web app or the Docker image in CI: Vercel builds the web app on every push, and the image is built on the VPS. Can be added later if a build breaks unnoticed.
- Dependabot or other automated updates of the pinned SHAs: needs a decision on who reviews them.
- Deploying from CI.

## Done when

- [x] On a PR, the `verify` check runs every step above and passes on the GD-2 branch itself.
- [x] The check fails, visibly on the PR, when (a) a test fails, (b) an entity changes without a migration, (c) a commit message or the PR title breaks Conventional Commits. Shown by running each failure locally the way CI runs it (below), not by pushing broken commits.
- [x] Every `uses:` line is a 40-character SHA with its tag in a comment; `permissions` is `contents: read`.
- [x] The same steps run locally in a clean `node:24` container against the throwaway Postgres, with `CI=true`, and pass (`HUSKY=0` left out locally, see Verification).
- [x] The playbook and `CLAUDE.md` say what CI enforces, and no rule is labelled `CI` that CI does not run.

## Plan

1. Look up the current release SHAs of the three actions (`gh api`, read-only).
2. `.github/workflows/ci.yml`.
3. Run every step locally in `node:24` (Docker) against `docker-compose.test.yml`'s Postgres, in a fresh clone of the branch, as CI would: install, build, typecheck, test, integration, migration check, commitlint over the branch's commits and a sample title. Then the three failure cases.
4. Docs: playbook, `CLAUDE.md`, `README.md`.
5. `/review` and the security-verifier agent (CI is a risky area), then hand over the git commands. The first real run happens on the PR.

## Contexts, contracts and configuration

No bounded context, contract, entity or migration changes. No new env variables for the app. CI sets `CI=true` (by GitHub), `HUSKY=0`, and the `TEST_DATABASE_URL` that `pnpm test:integration` already sets. No ADR.

## Security and data

- The workflow reads the repository only (`contents: read`) and uses no secrets. The read-only `GITHUB_TOKEN` is not left on disk after checkout (`persist-credentials: false`), so PR code cannot read even that. A fork's PR runs its own edited workflow, config and tests, so a green check from a fork is not a security boundary: changes under `.github/` need human review (CODEOWNERS and fork-workflow approval are in the playbook's section 12).
- PR titles and branch names are untrusted input: used only through `env:`, never inside `${{ }}` in a `run:` script.
- Actions pinned by SHA, so a moved tag cannot change what runs.
- The Postgres service has the same throwaway `agg`/`agg` credentials as `docker-compose.test.yml`; it lives only for the job.
- No user data involved.

## Tests and fixtures

No new test files: CI runs the existing suites (`pnpm test`: 35 tests; `pnpm test:integration`: 8 tests). Verified locally as in Plan step 3. No browser check: nothing a teacher sees changes.

## Rollout and risks

1. Merge GD-2; the first run is on its own PR.
2. Admin, separately: make `verify` a required check on `main` (playbook section 12).
- Risk: `pnpm/action-setup` must support pnpm 12 from `packageManager`; checked in Plan step 3 by reading the action's release notes and by the first PR run. Fallback: set `version: 12.17.0` explicitly.
- Risk: GitHub's runner image changes under `ubuntu-latest`; pinned to `ubuntu-24.04` instead (an OnlineJudge lesson).
- Rollback: revert the workflow file.

## Verification (2026-11-17)

- **Pinned SHAs** (`gh api`, checked again by the security verifier with `compare`, identical to the tags): `actions/checkout` v7.0.1 `3d3c42e5…` (released 2026-07-20), `pnpm/action-setup` v6.1.1 `73e46992…` (2026-11-03; pnpm 12 support since v6.1.0 per its release notes), `actions/setup-node` v7.1.0 `949feb24…` (2026-10-08).
- **Workflow file:** parses; 3 `uses:` all SHAs; 0 `run:` scripts contain `${{ }}`; `permissions: contents: read`; `persist-credentials: false`; Postgres bound to `127.0.0.1:55433`.
- **Every step in a clean `node:24` container** (Node v24.22.3, pnpm 12.17.0 from `packageManager` via corepack), in a fresh clone of `main` plus this branch's files, sharing the network of a throwaway Postgres 17 on 55433, `CI=true`: install `--frozen-lockfile` done; commitlint over the real range GD-0 merge..GD-1 commit and a sample title, 0 problems; `build:contracts` OK; typecheck Done ×3; `pnpm test` 35/35; `pnpm test:integration` 8/8; `migration:run` "up to date"; `migration:check` "No changes". `HUSKY=0` was not set locally (the assistant's settings deny that text); it only stops `prepare` from installing hooks in the throwaway clone.
- **Failures caught, same container:** a deliberately failing test, `pnpm test` exit 1 (35 pass, 1 fail); an unmigrated `drift_probe` column, `test:integration` exit 1 (2 fail) and `migration:check` exit 1 ("Unexpected changes"); `added stuff`, `Fix: the thing` and a body line over 100 characters, commitlint exit 1 each. A title containing `$(touch …)` and backticks was linted as text; no file appeared. Every change was undone (clean `git status`).
- **Title as committed:** with " (#N)" added, a 94-character title (99) passes and a 97-character title (102) fails.
- **Local gate:** build:contracts OK; typecheck Done ×3; `pnpm test` 35/35.
- **Reviews:** `reviewer` (0 blocking, 6 should fix, 3 nits) and `security-verifier` (nothing High or Medium). Fixed: the title re-checked on edit and linted with its " (#N)" suffix; only PR runs cancelled; `persist-credentials: false`; Postgres on 127.0.0.1; README, playbook definition of done and entity-migration rule say detection, not merge-blocking; playbook v1.1; the admin named in scope; fork-workflow approval added to the admin's settings; the brief's "Missing" line.
- **Second review (19 Nov, own pass plus `reviewer`: 0 blocking, 2 should fix, 5 nits).** Fixed:
  - Each push to `main` now gets its own concurrency group. GitHub keeps one pending run per group and replaces it whatever `cancel-in-progress` says, so a queued commit on `main` could lose its result.
  - The playbook now says the PR title is the commit on `main` only once the squash default message is "Pull request title". The admin steps (section 12) now set it. GitHub's default uses the commit subject for one-commit PRs.
  - The playbook's principle 3 now says commitlint runs on PRs only.
  - `pg_isready -h 127.0.0.1` in `ci.yml` and `docker-compose.test.yml`. Without `-h`, the first-boot init server answers on the socket before the real server takes TCP connections.

  Left as they are:
  - The commitlint range uses `base.sha`. It is harmless while `main` holds only squash commits.
  - pnpm comes from `pnpm/action-setup`, not corepack. The first PR run tests this. The fallback is `version: 12.17.0` or running `setup-node` first.
  - An `edited` event on the PR description re-runs the job. GD-9 C covers it.
- **Not done, recorded:** the Postgres image follows its tag, not a digest (a test database should get patches); `packageManager` has no `+sha512` hash; a stale `unrs-resolver` entry in `pnpm-workspace.yaml`'s build allowlist (pre-existing).
- **First run on GitHub** (PR #3, run 44474519577, 2026-11-19): `verify` passed in 54 s, and every step ran.
  - `pnpm/action-setup` v6.1.1 installed pnpm v12.17.0 from `packageManager`, so no fallback was needed.
  - Install used the lockfile as is.
  - commitlint found 0 problems in both checks: the PR's commits, and the title with " (#3)".
  - `pnpm test` passed 35/35, and `pnpm test:integration` passed 8/8 against the service on the new TCP health check.
  - `migration:run` applied the baseline to the empty service database. `migration:check` then found "No changes". `migrate.ts` prints "up to date" after applying, whatever was applied.
  - GitGuardian passed.
  - The concurrency group for pushes to `main` is first exercised on the merge.
