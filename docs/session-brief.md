# GóiĐề (agg): brief for a fresh Claude Code session

Written 17 November 2026. Checked against `ticuong78/agg` at commit `1f6726a` (branch `main`, pushed 16 November 2026).
Put this file in the agg checkout at `docs/session-brief.md` and point the session at it.

## 1. The product in one paragraph

GóiĐề turns a programming exam (PDF with text, Word, plain text) into a Themis `.contest` file that opens and grades
with no manual setup. The MVP runs with one pilot teacher in Dec 2026 to Jan 2027 and answers one question: does a
teacher save real time? Fixed date: public release 5 Sep 2027, before an exam on 9 Sep 2027.

## 2. MVP scope (agreed 16 November 2026)

In:
- Upload or paste: PDF with text, .docx or text, at most 5 MB, one file, no account.
- Rule-based split into problems, tuned on 5 to 10 real past exams, each kept as a fixture test.
- Review screen: task code, INP/OUT file names, time and memory limits, statement, tests; merge or split problems.
- Tests: examples from the statement, typed by hand, or imported from a zip in Themis layout
  (`BAI1/Test01/BAI1.INP`, `BAI1.OUT`) or as `1.inp`/`1.out` pairs.
- Pre-export checklist that blocks the download: every task has a code, file names, limits and at least 3 tests.
- Themis version picker that lists only versions we tested, each with a golden-file test. "Khác hoặc không rõ phiên bản"
  exports without limits and shows a per-task limits list.
- Feedback after export: "Được, chấm tốt" / "Có lỗi" plus an optional text box (text and the chosen version only).
- Short privacy page: originals never stored, guest sets deleted after 24 h, feedback 12 months, logs 30 days with
  hashed IPs, "Không dùng AI".
- One off-switch for everything outside the MVP (accounts, billing, growth, AI routes and pages).

Out of the MVP: AI of any kind (leave the Anthropic key unset; AI returns only if the pilot shows a need), accounts,
payments, referrals, rewards, Word/PDF statement exports, scans and photos.

Done when:
- A contest grades with limits in every Themis version the picker lists, with no manual setup.
- The reader splits at least 4 of 5 real past exams correctly with no merge or split.
- The pilot teacher converts one real past exam end to end, and we record the minutes it took.

## 3. What exists in agg (verified)

- pnpm monorepo, Node 24, TypeScript. `apps/api` (NestJS, DDD contexts identity, conversion, billing, growth, TypeORM
  on PostgreSQL), `apps/web` (Next.js for Vercel), `packages/contracts` (`@agg/contracts`: `api.ts`, `enums.ts`,
  `plans.ts`).
- Root scripts: `build`, `build:contracts`, `dev:api`, `dev:web`, `infra:up` (postgres only), `infra:down`,
  `typecheck`, `test`. Gate: `pnpm build:contracts && pnpm typecheck && pnpm test`.
- Tests: `apps/api/test/{billing,conversion,growth}.test.ts`, `node --test`. No web tests.
- Docs: `CLAUDE.md` (Vietnamese rules), `docs/ARCHITECTURE.md`, `docs/PRODUCT.md`, `docs/THEMIS-FORMAT.md`,
  `docs/DEPLOY.md`.
- Conversion: `domain/exam-parser.ts` (copied from OnlineJudge), `infrastructure/document-reader.ts`,
  `exporters/contest.exporter.ts` (Tasks, tests, Contestants, statements, read-me; no settings file, so no limits),
  `retention.sweeper.ts`, Claude adapters (`claude-smart-reader.ts`, `claude-test-suggester.ts`,
  `claude-section-writer.ts`).
- Guest plan in `plans.ts`: 5 MB, 1 file, retention 1 day.
- Missing (as of 17 November 2026, before GD-0 and GD-1; since done: migrations in GD-1, CI in GD-2, the MVP off-switch (feature flags) in GD-3, git hooks and commitlint, specs and ADR folders, the playbook, `.claude/skills` and `.claude/agents` in GD-0): migrations (schema only with `DB_SYNC=true`), CI, git hooks, commitlint, specs and ADR folders, the
  playbook, `.claude/skills` and `.claude/agents`, feature flags, test zip import, checklist, version picker,
  feedback.
- The repo is public. Decision 07 recommends making it private until the review findings are fixed.

## 4. Order of work (decision 11)

| # | Work | Waits on |
|---|---|---|
| 0 | Install the playbook, skills and agents from OnlineJudge, adapted to agg; baseline gate | nothing |
| 1 | First migration with `DB_SYNC` off; migration check test | 0 |
| 2 | CI: typecheck and tests on every PR | 0 |
| 3 | MVP off-switch: flags that close every non-MVP route and page, with tests that they are closed | 1 |
| 4 | Reader tuned on real exams, one fixture per exam | Cường's 5 to 10 exams, due 24 Nov 2026 |
| 5 | Test zip import | 3 |
| 6 | Pre-export checklist and feedback buttons | 5 |
| 7 | Short MVP privacy page | 3 |
| 8 | Themis version picker and one settings writer per tested version, golden-file tests | Cường's Themis results, due 15 Dec 2026 |

Steps 4 and 8 depend on Cường. Cường does all testing in Themis on a real x86 Windows PC and hands over, per version:
the version number, import steps, and a golden contest folder before and after changing a task's limits.

## 5. Rules for the session

1. Read `CLAUDE.md`, `docs/ARCHITECTURE.md` and this brief first. Once step 0 lands, the playbook and skills are the
   rules too.
2. Start every step from a spec in `docs/specs/` (`GD-<n>-<slug>.md`), present it and stop until Htet approves.
3. Do not run `git add`, `git commit`, `git push`, or create branches or PRs. Htet runs git; give Htet the commands.
4. Never read, print or commit `.env` files or keys. `.env.example` is the only template.
5. Ask before adding or changing any dependency.
6. User-facing strings in Vietnamese; code, comments and docs in English (or follow the file, as agg's `CLAUDE.md`
   says).
7. No AI in the MVP: do not call Anthropic, do not add prompts, and make sure every route works with no key.
8. Never store uploaded originals; anything new about a user goes on the privacy page with a retention period.
9. Run the gate before saying a step is done and report the summary lines. Run a live check in the browser for
   anything a teacher sees, and say what was not checked.
10. Port parser fixes back to OnlineJudge's `exam-parser` as a note in the PR (the two copies must not drift).

## 6. Reference material

- Design canvas (five MVP screens, Vietnamese): https://claude.ai/artifact/YTtRwibj713TGiNQoaCXKW
- MVP brief (status, flow, architecture, decisions, risks): https://claude.ai/artifact/JuQVZQmaPoJMBv4UvCPQCH
- Plan doc: https://claude.ai/artifact/3qT6QEQ93oN2apnyr8wiQW
- OnlineJudge playbook and tooling to copy in step 0, from
  `/Users/htetoonaing/Downloads/Personal Projects/OnlineJudge`: `docs/ai-engineering-playbook.md`,
  `docs/specs/TEMPLATE.md`, `.claude/skills/{spec,review,security-audit}/`, `.claude/agents/{reviewer,security-verifier}.md`,
  `.claude/settings.json`, `commitlint.config.cjs`, `.husky/`.
