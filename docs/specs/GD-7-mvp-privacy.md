# GD-7: Short MVP privacy page, true to the code

Status: done (approved by Htet Oo Naing, 2026-11-19, with all three recommendations: guest data left out of backups, size-based log rotation, the feedback line left for GD-6)
Owner: Htet Oo Naing
Risky area: yes (playbook section 8). It changes `deploy/**` (backup script, log rotation) and adds a cleanup job that deletes data.
MVP: in (brief section 2: "Short privacy page: originals never stored, guest sets deleted after 24 h, feedback 12 months, logs 30 days with hashed IPs, 'Không dùng AI'")
Waits on: nothing (GD-3 merged). It unblocks the public pilot (GD-3 rollout rule, DEPLOY checklist).

## Outcome

In MVP mode, `/privacy` is a short page that says exactly what the MVP keeps, for how long, and who receives it. Every period on it matches the code, the backup script and the log settings, and a test fails if they drift. An inventory of the MVP path (19 Nov) found four places where the code would make such a page false. GD-7 fixes them first, then writes the page.

## What the MVP keeps today, and the gaps

| Data | Where | Kept | Gap |
|---|---|---|---|
| Exam text, file names, settings, the browser's random id, the access key's SHA-256 | `conversions` | 24 h (`plans.ts` guest `retentionDays: 1`, hourly sweep) | The nightly `pg_dump` keeps it **14 more days** (`deploy/backup.sh`) |
| Daily allowance counters: the browser's random id and the IP's HMAC hash | `daily_usage` | **forever** | No cleanup exists |
| Anonymous events: problem count and export format, with no id | `analytics_events` | 730 days (a literal in `tracking.service.ts`) | Not on any page |
| API and Caddy output | Docker stdout | **unbounded** | No log rotation in `deploy/docker-compose.yml`. No IP, id or exam text is logged; Caddy writes no access log |
| Random browser id (`agg.visitor`), access keys (`agg.guestKeys`) | browser localStorage | id: until cleared; keys pruned after 48 h | No way for a guest to delete a set: the web never calls the open `DELETE` route |
| Uploaded originals | memory only | the request and the job | none |

No AI, no analytics script, no cookies, no third party on the MVP path apart from hosting: the VPS for the API and database, and Vercel for the web pages. Fonts are self-hosted at build time.

## Scope

In:
1. **Retention numbers in one place:** a `Retention` object in `packages/contracts/src/plans.ts`. It holds the guest set (derived from the guest plan), usage counters (2 days), anonymous events (730 days, moved from the literal), browser access keys (48 h), backups and log rotation. The page, the cleanup jobs and the web read these values; nothing repeats them.
2. **Close the gaps:**
   - (a) `daily_usage`: a daily cleanup in billing deletes counters older than 2 days. The counter only needs today.
   - (b) Backups: `pg_dump --exclude-table-data` for `conversions` and `daily_usage`, so guest data that lives 24 h is not kept 14 days in dumps (decision 1).
   - (c) Logs: Docker `json-file` rotation on every service in `deploy/docker-compose.yml` (decision 2).
   - (d) The web: a "Xoá bộ đề" (delete set) button on the review screen, which calls `DELETE` and forgets the key. Keys are pruned by `Retention`.
3. **The page:** in MVP mode, `/privacy` renders a short page; full mode keeps today's page. Sections:
   - what we keep and for how long (a table from `Retention`);
   - "Không dùng AI" (no AI);
   - recipients (the VPS provider, Vercel);
   - browser storage (two keys, no cookies);
   - your choices (delete a set now, clear the browser, e-mail us);
   - students (remove names before uploading);
   - contact.

   The legal-page sidebar shows only this page (already done in GD-3). No consent buttons, since nothing is tracked.
4. **Docs:**
   - DEPLOY: the backup and log changes; the GD-3 pre-launch item is ticked, and the lawyer review stays.
   - Playbook section 7 rules 2 and 3 (sweeps, backups, logs).
   - The GD-3 spec's Measures: the merge time, as promised.

Out:
- Feedback (GD-6) adds its own "12 months" line to this page when it ships, per CLAUDE.md data rule 4 (decision 3).
- Legal review of the text: it stays in DEPLOY's pre-launch checklist. The page is not legal advice.
- The full-mode privacy, terms and data-protection pages: unchanged.
- Rotating the IP hash secret, and third-party error messages in logs. Both are recorded as known limits below.

**Decisions** (approved 2026-11-19):
1. **Backups:** exclude guest data, so "24 h" holds everywhere, or keep it and disclose "up to 14 more days in backups"? Recommended: **exclude**. Losing up to 24 h of guest sets on a restore costs little; a teacher can upload again.
2. **Logs:** the brief says "logs 30 days with hashed IPs". The API logs no IP at all, and Docker can rotate by size but not by age. Options: size rotation (10 MB × 3 files per service), with the page saying logs hold no IP, id or exam text and are overwritten as they fill; or a time-based rotation on the VPS, outside the repository. Recommended: **size rotation**, a deviation from the brief's wording that promises more privacy, not less.
3. **Feedback line:** leave it for GD-6, so the page never describes data not yet collected? Recommended: **yes**.

## Done when

- [x] In MVP mode, `/privacy` shows the short page. Every period on it comes from `Retention`, and none appears as a literal in the page.
- [x] A unit test fails if:
  - the backup script stops excluding `conversions` or `daily_usage`;
  - a service in `deploy/docker-compose.yml` lacks log rotation, or its sizes differ from `Retention`;
  - the guest set period differs from the guest plan.
- [x] An integration test: counters older than 2 days are deleted by the cleanup; today's and yesterday's stay.
- [x] In the browser, a guest deletes a set from the review screen. The API answers 204, its key leaves localStorage, and reopening the link shows "not found".
- [x] Full mode still shows today's privacy page.
- [x] Browser check at desktop and 375 px, MVP mode. Gate and `test:integration` pass.

## Plan

1. Contracts: `Retention` in `plans.ts`; `build:contracts`.
2. API, billing: `DailyUsageRepository.deleteBefore(day)` (domain port, TypeORM implementation), and a `UsageSweeper` with a daily cron in application. Growth: `tracking.service.ts` reads `Retention.analyticsDays`.
3. Deploy: `backup.sh` (`--exclude-table-data`), `docker-compose.yml` (`logging:` on postgres, api and caddy).
4. Web: `lib/guest-keys.ts` (prune by `Retention`); a delete button in the workspace with a confirm dialog, calling `api.deleteConversion` and `forgetAccessKey`, then going to `/`; `app/privacy/page.tsx` splits into the MVP page and the full page.
5. Tests, docs, `/review` and `security-verifier` (deploy, data deletion), the gate, the browser check.

No new cross-context call. The sweeper lives in billing, which owns `daily_usage`.

## Contexts, contracts and configuration

- **Contexts:** billing (sweeper, repository) and growth (one constant).
- **Contracts:** `plans.ts` (`Retention`).
- **Database:** no entity change, no migration; the cleanup is a `DELETE` on an existing table.
- **Configuration:** no new environment variables. The deploy files change, so the VPS needs `docker compose up -d` and the new `backup.sh`; this goes into the DEPLOY upgrade notes. No ADR: this is the playbook's existing rule 3 applied.

## Security and data

- The sweeper deletes only `daily_usage` rows with `day` older than the cutoff, in one statement, logging only a count.
- Delete in the web uses the existing route and checks: the access key, and 404 when it can't be opened.
- Nothing new is collected; the change only removes data or keeps it for less time.
- **Known limits, written on the page or in the spec:**
  - The IP hash is keyed but never rotated, so it is pseudonymous, not anonymous. The page treats it as personal data.
  - Vercel keeps its own request logs under its plan; the page says so.
  - Error messages from the PDF and Word parsers are logged as they are. The page says a file-reading error may include a short fragment of the file.
  - There is no request-level log, so after an incident nobody can trace who sent what. DEPLOY says to snapshot the logs at once.

## Tests and fixtures

- `apps/api/test/privacy-promises.test.ts` (unit): `Retention` against `plans.ts`, `deploy/backup.sh` and `deploy/docker-compose.yml`, the last read with regular expressions on its non-comment lines (deviation 4); no new dependency.
- `apps/api/test/usage-sweeper.integration.test.ts`: a migrated throwaway schema, with rows for today, yesterday and 3 days ago; the sweep leaves two.
- Browser: `/privacy` at desktop and 375 px in MVP mode; delete flow; `/privacy` in full mode, still the old page.

## Rollout and risks

1. Merge, then on the VPS: pull, `docker compose up -d` (applies log rotation), and the new `backup.sh`, which is used by the next nightly run.
2. Existing dumps made before GD-7 still contain guest data. They age out within 14 days, or the operator deletes them; DEPLOY says so.
- **Risk:** the first sweep deletes many old counters, but in one statement on a small table.
- **Rollback:** revert. The deleted counters only gated "3 per day" for days already past.

## Deviations

All approved by Htet with "Yes, fix them" (19 Nov) before they were made. They came from the review of the first implementation.

1. **Caddy's error log is filtered** (`deploy/Caddyfile`). The spec assumed "Caddy writes no access log" was enough. Caddy's always-on error log recorded the client IP and every header, including the guest's access key and browser id. Shown by running Caddy with the old and the new file against a missing API.
2. **The API logs unexpected errors by name and message only** (`api-exception.filter.ts`). Before, it logged the whole error object, and a failed query carries its parameters (exam text, browser id, hashed IP). The repository also strips NUL characters, which PostgreSQL cannot store and which made such writes fail.
3. **A deleted set stays deleted.** `ConversionRepository` now has `insert` for new sets, and `save` updates only a row that still exists. Before, a job that loaded a set and saved it after a delete brought its content back.
4. **The compose file is read with regular expressions,** not js-yaml. js-yaml is not a dependency of the API, and the test only needs the services and their `logging` lines.
5. **Backups read the mode from the running API container,** falling back to `api.env` read the way Compose reads it. An unknown value stops the backup. The first version's `sed` misread quoted values, `export` and trailing comments, which would have silently dropped accounts' sets from full-mode backups.

## Measures (filled when done)

- Elapsed: about 18 minutes from approval (19 Nov 12:09 UTC) to the first report of done, then about 7 minutes of fixes after review (to about 12:27 UTC). Merge is still to come.
- Review findings before reporting done, after one round:
  - `reviewer`: 3 blocking, 6 should fix and 6 nits.
  - `security-verifier`: 3 Medium and 5 Low.
  - All are fixed or recorded as known limits. The only exception is `plans.ts`'s marketing perk "Kết quả giữ 24 giờ", left as is.
- Escaped defects: none yet. The review came before any report of done.
- Htet's attention: about 10 minutes, estimated (approval, one fix decision).
- Deviations: 5 (above).
- Rule breaches: none. The two refused commands (`api.env` in a test command, `--no-verify` in an earlier sed) were rerouted without the refused text and without a wrapper.

## Verification (filled when done)

- **Gate:** `build:contracts` OK; typecheck Done ×3; `pnpm test` 53/53. New: 4 promise tests and 1 error-logging test.
- **Integration:** `pnpm test:integration` 17/17. New: the usage sweep test, plus two repository tests (a save after a delete; NUL characters).
- **Failing before the fix:** each regression test fails with the old code put back (old error logging, upsert save, no NUL stripping). The promise test fails on each of five mutations of the deploy files:
  - `pg_dump` without `$EXCLUDE`;
  - the `full)` case commented out;
  - `-mtime +14`;
  - Caddy without log rotation;
  - the headers filter commented out.
- **Caddy, run locally** (`caddy:2-alpine`, no API behind it):
  - With the old Caddyfile, a 502's error log held `X-Access-Key`, `X-Visitor-Id` and `remote_ip`.
  - With the new one, the probe key, the visitor id and the client IP appear nowhere in the log. The entry keeps method, host and path. `caddy validate` passes, with no deprecation warning.
- **Backup mode parsing:** 10 sample env lines, with the API container down, behaved as intended:
  - `full` in any form (quoted, `export`, trailing comment, last of two lines, CRLF) keeps conversions in the backup;
  - commented out or missing leaves them out;
  - `beta` stops the backup.

  shellcheck passes.
- **Browser, MVP mode** (API 4100, web 3100):
  - `/privacy` shows the table with every period from `Retention`: 24 h, 3 a day, 2 days, 24 months, 3 × 10 MB, 14 days, 48 h.
  - At 375 px nothing scrolls sideways, the table fits (343 of 375 px), and fonts are served by the site.
  - Delete from the review screen: `DELETE` 204, the key left localStorage, the page went to `/`, and reopening the link showed "Không tìm thấy bộ đề" (set not found).
  - Delete on the export step: present.
  - Delete of an already-deleted set: no error, the key was removed, the page went to `/`.
  - A 49-hour-old key was pruned on loading `/`, and a 1-hour-old one was kept.
- **Browser, full mode** (web on 3101): `/privacy` shows the full page, and `/login` is open (200).
- **Not checked:**
  - a real backup and restore with `pg_restore` (the dump format and the absence of foreign keys were checked by reading);
  - Caddy's TLS site block (tested on `:8080` without TLS; the log filter is global);
  - the cron schedules running at their times (the timezone option was checked by reading; the sweep logic by the integration test).
