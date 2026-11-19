# GD-0: Playbook, skills, agents and local gates

Status: done
Owner: Htet Oo Naing
Risky area: yes (gates and tooling: `.claude/**`, `.husky/**`, `commitlint.config.cjs`, `CLAUDE.md`, the playbook)
MVP: in
Waits on: nothing

Written after the work, on 2026-11-17, so that step 0 has a record like every other step.

## Outcome

Every Claude Code session on agg starts with the same rules, procedures and local gates as OnlineJudge, adapted to agg, before any product step begins.

## Scope

In: the playbook, spec template and README, ADR 0001, the `spec`, `review` and `security-audit` skills, the `reviewer` and `security-verifier` agents, `.claude/settings.json`, a Workflow section in `CLAUDE.md`, `husky` (pre-push gate, commit-msg) and `commitlint` (approved by Htet on 2026-11-17).
Out: CI (GD-2), migrations (GD-1), branch protection and making the repository private (repository settings).

## Done when

- [x] The files above exist and name agg's paths, packages, contexts and commands; spec ids are `GD-<n>`.
- [x] `CLAUDE.md` has a Workflow section pointing to the playbook, the brief, ADRs and the spec rule, and states the MVP's no-AI and no-`.env` rules.
- [x] `.claude/settings.json` denies dependency changes, git writes, branch and PR creation, `.env` reads and hook bypasses (best effort).
- [x] `commit-msg` rejects a message with no type; `pre-push` runs the gate.
- [x] The gate passes.

## Plan

Root: `package.json` (`prepare`, devDependencies), `pnpm-lock.yaml`, `commitlint.config.cjs`, `.husky/`. Docs: `docs/ai-engineering-playbook.md`, `docs/specs/`, `docs/adr/0001-record-decisions.md`, `CLAUDE.md`. Tooling: `.claude/settings.json`, `.claude/skills/`, `.claude/agents/`. No product code.

## Contexts, contracts and configuration

None. New devDependencies: `husky 9.1.7`, `@commitlint/cli 21.2.4`, `@commitlint/config-conventional 21.2.4`.

## Security and data

No routes or data. `.claude/settings.json` deny rules match command text, so they are best effort, not a sandbox.

## Tests and fixtures

No product tests. Checked by hand: commitlint on sample messages, the pre-push script, the Docker image's filtered install without `.git`.

## Rollout and risks

GUI git clients may not find `node` or `pnpm`; the playbook's onboarding says how to fix it. The `prepare` script runs during the Vercel install; husky exits 0 without `.git`, to confirm on the first deploy.

## Measures (back-filled by GD-9 on 19 Nov, from the session transcript and GitHub)

- Elapsed: about 2 h 20 min, from the brief arriving (17 Nov 07:46 UTC) to the merge of PR #1 (10:07 UTC). No separate approval time was recorded.
- Review findings before merge: 0 blocking, 13 should fix (`/review` plus `reviewer`), all fixed before the first commit.
- Escaped defects: 1. The second review (17 Nov, 13:15 UTC) found that `.claude/settings.json` blocked legitimate commands and left write paths open (`gh api -X`, `git -C … commit`). This is fixed in GD-9.
- Htet's attention: about 25 minutes, estimated (approving the dependencies, the review round, setting up SSH for the push, the merge).
- Deviations from the spec: none recorded.

## Verification

- Gate: build:contracts OK; typecheck `Done` for contracts, api, web; `tests 31, pass 31, fail 0`.
- Reviewed by `/review` and the `reviewer` agent; its findings were fixed in the same change.
- Not checked: a Vercel deploy with the `prepare` script; the hooks inside a GUI git client.
