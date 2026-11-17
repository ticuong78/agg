---
name: spec
description: Write or update a one-page spec in docs/specs before implementing a change in agg (GóiĐề). Use when a feature, fix or refactor is requested and no approved spec exists.
---

# Spec

1. Pick the id: GD-0 to GD-8 are reserved for the steps in `docs/session-brief.md` section 4 (`GD-<step>`). Any other change uses `GD-<n>` with n one higher than the larger of 8 and the largest id in `docs/specs/`.
2. Copy `docs/specs/TEMPLATE.md` to `docs/specs/GD-<n>-<slug>.md` and fill every section, including the plan (files per context, in edit order) and what the work waits on. Keep it to about one page.
3. "Done when" items must be observable: a route responding, a test passing, a screen behaving, a Themis contest grading. No "improve" or "refactor" without a measurable result.
4. Check the change against the MVP scope in `docs/session-brief.md` section 2. Work outside it (accounts, billing, growth, AI, statement exports) needs a reason in the spec.
5. List the bounded contexts touched (identity, conversion, billing, growth) and check the dependency direction in `CLAUDE.md`. If the change needs a new cross-context call, name the facade or event that will carry it.
6. List contract changes (`@agg/contracts`: `api.ts`, `enums.ts`, `plans.ts`), database changes (entities, the migration), and documentation to update (`docs/ARCHITECTURE.md`, `docs/THEMIS-FORMAT.md`, `docs/DEPLOY.md`, `README.md`, the privacy page).
7. If the change calls Claude (not during the MVP): model variable, prompt location and version, zod schema, cost per call and credit cost in `plans.ts`, fallback with no key, the data sent to the model, and the before-and-after check from playbook section 6.
8. If the change stores anything new about a user: the privacy page entry, the retention period and how it is deleted (a retention sweep; and the context's `AccountDeleted` handler when it is tied to an account).
9. If the change adds configuration (env variables, flags): `.env.example`, the check in `apps/api/src/config/environment.ts`, and `docs/DEPLOY.md`.
10. If the change makes a decision that constrains later work (ADR 0001): name the ADR to write.
11. If the change touches a risky area (playbook section 8): say so and add the security-verifier step to the plan. A change to CI, hooks or `.claude/` says so explicitly.
12. Name the tests to add or change, by file, any fixtures (real exams with personal data removed), and the browser checks for anything a teacher sees (desktop and 375 px).
13. Present the spec and stop. Implementation starts only after the owner marks the status `approved`. When done, fill the Verification section with the gate's summary lines and what was not checked.
