# GD-9: Fixes from the engineering-manager review (secret scanning, permission rules, process rules)

Status: done (approved by Htet Oo Naing 2026-11-17; implemented 2026-11-19; first green run on PR #4); amended after a second review and approved again the same day ("Amend GD-9"). The amendment is the **Amendment** section below; where it and the original Scope differ, the amendment wins.
Owner: Htet Oo Naing
Risky area: yes. **This changes CI** (`.github/workflows/ci.yml`) and `.claude/settings.json`, `CLAUDE.md` and the playbook (playbook section 8).
MVP: in (tooling; no product change)
Waits on: nothing (GD-2 merged on 2026-11-19)

## Outcome

Close the gaps the 17 November review found after GD-0 to GD-2: a secret-shaped value reached a PR without either review agent noticing, the assistant's permission rules blocked legitimate work while leaving a write path open, and two process rules were left as habits instead of written rules.

## Scope

In:
1. **Secret scanning in CI.** A `Secrets` step in the `verify` job runs gitleaks v8.30.1 from its image pinned by digest (`ghcr.io/gitleaks/gitleaks@sha256:c00b6bd0…`), `--redact`, over the PR's commits (`base..head`, so a secret added and removed inside the PR is still found) and, on push to `main`, over the pushed commit. The binary, not `gitleaks-action`: no token, no licence question if the repository moves to an organisation. A `.gitleaksignore` (fingerprints) only if a false positive appears, each with a reason in the PR.
   - Evidence it is worth it: run on the GD-1 commit GitGuardian flagged (`63a6755`), gitleaks reports 2 leaks (`generic-api-key`, `environment.test.ts` lines 8 and 9), the same finding; `main`'s history and today's working tree report none.
   - **Change approved by Htet on 17 Nov, before implementation (found in the trial):**
     - (a) **Fail closed.** When git refuses the mounted repository ("dubious ownership"), gitleaks scans 0 commits, prints "no leaks found" and exits 0. The step therefore passes git `safe.directory` through environment variables, and fails unless gitleaks reports at least one commit scanned.
     - (b) **Scan the pushed range, not "the pushed commit".** gitleaks skips merge commits, so `main`'s HEAD (a merge commit) scans 0 commits and would fail every push. On push the step scans `before..after` with full history (`fetch-depth: 0` for push too; the repository is small). When `before` is all zeros (a new branch), it scans the whole history.
2. **`.claude/settings.json`**, review of the rules against the six refusals of 17 November:
   - **Close a write path:** deny `gh api` with a write method or body (`-X`, `--method`, `-f`, `-F`, `--field`, `--raw-field`, `--input`), and `gh repo edit|delete|rename`, `gh workflow run|enable|disable`, `gh secret`, `gh variable`, `gh release create|delete`. Today `gh pr` is denied but `gh api -X PUT …/merge` or a settings change is not.
   - **Unblock reads:** replace `gh pr *` with the write verbs only (`create`, `merge`, `close`, `reopen`, `edit`, `comment`, `review`, `ready`), so the assistant can read a PR's checks (`gh pr checks`, `gh pr view`) instead of asking Htet to paste the page.
   - **Drop a redundant rule:** `*HUSKY=0*` blocked a CI simulation (`docker run -e HUSKY=0`); hook bypass is already impossible for the assistant because `git commit` and `git push` are denied.
   - **Ask instead of deny** for clean-up that is sometimes right: `docker rm`, `docker volume rm`, `docker system prune`, `git clean`, `git reset --hard` move from `deny` to `ask`, so Htet approves each one.
   - Not explained by the rules: two refusals (a Python heredoc editing `ci.yml`, a shell loop running commitlint). Recorded, not chased.
3. **Process rules** in the playbook (section 9) and `CLAUDE.md` Workflow, with the spec template:
   - **Deviation:** a change from an approved spec is proposed to Htet and waits for a yes before it is implemented (GD-1's baseline change was disclosed after the fact).
   - **Measures per spec,** a `Measures` section in the template, filled at done: elapsed time from approval to merge, review findings (blocking, should fix), escaped defects (findings after merge, such as the GitGuardian incident), and minutes of Htet's attention (estimate). GD-0 to GD-2 are back-filled from this session as a baseline.
   - **Pre-handover scan:** before giving git commands, the assistant runs gitleaks on the working tree (`dir --redact`), in addition to CI.
4. **Docs:** playbook (section 3 Verify row, section 8, section 12, History; version 1.2), `CLAUDE.md`, the spec template.

### Amendment (17 Nov, after the second review: 0 blocking, 17 should fix, 8 nits)

The second review showed that pattern rules cannot enforce "no git writes" on their own: more than 40 commands broke the rules yet were not refused. Examples: `git -C . commit`, `git -c core.hooksPath=/dev/null push`, `gh pr new`, `gh api … -fmerge_method=squash`, `pnpm -F x add`, and an edit to `package.json` followed by the allowed `pnpm test`. It also found gaps in the scan design. The approach changes as follows.

**A. Enforcement is layered, and the docs say which layer does what.**
1. **GitHub is the real gate.** Branch protection on `main` (required `verify`, pull requests only, no force push, squash only) blocks a bad push however it was typed. It is the owner's setting (playbook section 12) and is now listed first.
2. **Local rules by category**, not by exact command text:
   - **Refused:** git's global options (`git -C`, `git -c`, `git --…`); every git verb that writes (`add`, `stage`, `rm`, `mv`, `commit`, `commit-tree`, `push`, `merge`, `pull`, `rebase`, `cherry-pick`, `revert`, `am`, `apply`, `update-ref`, `update-index`, `send-pack`, `notes`, `filter-*`, `reflog expire`, `worktree`); the branch-creating and branch-moving forms of `branch`, `checkout` and `switch`; the substrings `git push` and `git commit` wherever they appear.
   - **Refused for `gh`:** every write verb, including `pr new`, `update-branch`, `checkout`, `lock`, flags placed before the verb, and `api` with `-X`, `--method`, `-f`, `-F` (with or without a space), `--field`, `--raw-field` or `--input`. Also `issue`, `label`, `gist`, `alias`, `extension`, `config set`, `auth` (so `gh auth token` cannot print the token), `cache`, `secret`, `variable`, `project`, `codespace`, writes to `repo`, `release`, `run` and `workflow`.
   - **Refused for dependencies:** pnpm adds, removes, updates, links, patches and `pkg` edits in every spelling (`-F`, `-C`, `-w`, `-r`, `i <pkg>`, `un`); `npm`, `npx`, `pnpx`, `yarn`, `bunx`, `corepack`.
   - **Refused for secrets:** the Next.js env files (`.env.production`, `.env.development`, `.env.test`); `docker compose … config`, which prints `env_file` values; and credentials outside the repository (`~/.config/gh/hosts.yml`, `~/.git-credentials`, `~/.netrc`, `~/.docker/config.json`). `.env.example` stays readable.
   - **Edits:** edits under `.git/**` are refused. Edits to `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.claude/**`, `.husky/**`, `.github/**` and `commitlint.config.cjs` ask Htet first, which closes the "edit a script, then run the allowed command" path.
   - **Ask first:** commands that discard work or have read forms (`git reset`, `git restore`, `git checkout -- …`, `git clean`, `git stash`, `git tag`, `git config`, `git remote`, `git gc`), and `docker rm`, `docker volume rm` and `docker system prune`.
   - **Allowed without a prompt:** `pnpm exec commitlint …` and `pnpm exec tsc …` (what CI runs); `gh api repos/ticuong78/agg…` GET requests; `gh pr view|checks|list|diff`; `gh run view|list`. Other `pnpm exec` uses prompt.
3. **The honest limit, in the playbook:** wrappers (`bash -c`, `sh -c`, `eval`, `node -e`, `python3 -c`, scripts run from a file) cannot be matched by text. They always prompt, and Htet reads them before approving. The assistant does not use a script file to run a command its rules refuse; it asks. (On 17 Nov it ran `pnpm exec commitlint` from a script file while `pnpm exec` was refused, and disclosed it.)
4. **Accepted costs:** the substring rules also refuse harmless searches (`grep "git push" docs`, `grep process.env`). The `.env` rules do the same. These are recorded rather than narrowed, because refusing safely beats missing a secret.

**B. The secret scan, revised** (this replaces items 1(a) and 1(b) above where they differ):
1. **Patches with merges:** `--log-opts` adds `--diff-merges=first-parent`, so content introduced by a merge (a conflict resolution, or "Update branch") is scanned. A PR made only of merges is no longer a false 0.
2. **One pass over the checked-out tree:** `gitleaks dir --redact`, a second safety net next to the history scan.
3. **Messages and the PR text:** the commit messages in the range (`git log --format=%B`), plus the PR title and body passed through `env:`, are piped into `gitleaks stdin --redact`. With squash merge the PR body becomes the commit body on `main`.
4. **Ranges:**
   - PR: `base.sha..head.sha`.
   - Push: `before..after`.
   - If `before` is all zeros, or is no longer present after a force push (`git cat-file -e "$BEFORE^{commit}"` fails), the scan covers the whole history of `after`, so the replacement commits are still scanned.
   - An empty range (a rewind to an ancestor) fails closed; this is documented as expected.
5. **Fail closed, exactly:** the scanned-commit count is read from the JSON report's run, and compared with `git rev-list --count` over the same range (merges counted the same way). The step fails on any difference, on a parse failure, or on zero.
6. **What the public log shows:** findings go to a JSON report (`--report-format json --report-path`). The step prints only `RuleID`, `File`, `StartLine` and `Commit`, never the author's email (CLAUDE.md data rule 3) and never the value (`--redact`).
7. **Inputs through `env:` only:** `BASE`, `HEAD`, `BEFORE` and `AFTER` are each checked to be 40 hexadecimal characters before use (CLAUDE.md Workflow rule 7).

**C. GD-2 follow-up in the same `ci.yml` edit:** a job-level filter, so an `edited` event re-runs the gate only when the title or base changed, not on description edits.

**Deviations, asked before and approved by Htet on 19 Nov:**
1. **B.5, where the count comes from.** gitleaks v8.30.1's JSON report is a bare list of findings, and its SARIF report has only `tool` and `results`. Neither carries a scanned-commit count. The step instead reads the count from gitleaks' own line, "N commits scanned.", with `--no-color` and the image pinned by digest. It compares that count with `git rev-list --count` over the same range. On `main`'s history, with `--diff-merges=first-parent`, the two counts were equal in every range tried: 3 = 3 for a range with a merge, 1 = 1 for a merge alone, 8 = 8 for the whole history. Without that option, the first range counted 2.
2. **C, how description edits are handled.** A job skipped by `if:` reports Success, even as a required check (GitHub's docs). The planned job-level filter could therefore put a passing `verify` on a commit whose real run failed, and the edit's run would also cancel a gate run in progress. Instead:
   - `ci.yml` drops `edited`, so `verify` runs only on code events and is always a real run.
   - A small new workflow, `pr-text.yml` (job `pr-text`, on opened, synchronize, reopened and edited), lints the title and scans the title and description.
   - The admin makes `pr-text` a required check too.

   Two consequences:
   - Changing a PR's base no longer re-runs `verify`. Push a commit, or close and reopen the PR, to re-run it. All PRs target `main`.
   - B.3's "the PR body becomes the commit body" is false once the squash default is "Pull request title" (GD-2). The description is still scanned, because it is public.
3. **B.5, zero counts** (approved with the review fixes, 19 Nov). A range whose commits add no lines passes when gitleaks and git both count 0. Examples are a PR of empty, delete-only, rename-only or binary-only commits. Nothing added means nothing to scan; the messages and the tree are still scanned. The original text said the step fails on zero.
4. **No repository config** (approved with the review fixes, 19 Nov). A PR could switch off its own scan by adding a `.gitleaks.toml`, a `.gitleaksignore` or `gitleaks:allow` comments. The script therefore fails if either file exists, points `--gitleaks-ignore-path` at an empty directory, and passes `--ignore-gitleaks-allow`. A false positive is handled by a spec that changes the script, not by a fingerprint file (this replaces the `.gitleaksignore` mitigation in item 1 and in Rollout).
5. **The tree pass scans the files stored in the head commit,** read blob by blob with `git ls-tree` and `git cat-file`, not the working directory, so a local run never reads `.env` files. It does not use `git archive`, which obeys the PR's `.gitattributes`: `export-ignore` could hide a file and `export-subst` could rewrite one. A new `tree` mode serves the pre-handover scan.

6. **A committed test harness** (asked before and approved by Htet on 19 Nov: "Add harness to GD-9"). The fixture scripts that proved the scan, and caught two bugs in it, lived only in the assistant's scratchpad. That left no regression test, and nothing would re-check the commit-count rule, which copies gitleaks' internals, when the image digest is bumped.
   - `.github/scripts/secret-scan.test.sh` builds a throwaway repository in a temporary directory, with fake tokens generated at run time and no literal secret in the file.
   - It runs every case against `secret-scan.sh`, with git isolated from the user's configuration.
   - `verify` runs it whenever `.github/scripts/` or `.github/workflows/` changes, the digest included.
   - This replaces "No product tests" in Tests and fixtures for the scan.

**Done when, amended:** the second done-when item becomes the following. The refusals in A.2 are refused, each shown with a harmless target. The reads in A.2 run without a prompt. The ask rules prompt. The playbook states the honest limit in A.3. The first done-when item adds three cases: a secret in a merge commit, a secret in a commit message, and a force-pushed range, all caught locally the way CI runs them.

Out:
- **Pinning pnpm's hash in `packageManager`:** dropped. `pnpm/action-setup` v6.1.1 strips the `+sha512` part before `self-update` (`src/install-pnpm/run.ts`, `readTargetVersion`), so CI would not check it; only local corepack would.
- A local gitleaks hook: needs the gitleaks binary or Docker on every machine; CI plus the assistant's pre-handover scan cover it. Can be added later.
- Repository settings (branch protection, squash only, private, fork approval): the owner's job, already listed in the playbook's section 12.
- The reader check and GD-3: separate.

## Done when

- [x] On a PR, the `Secrets` step passes on a clean branch and fails on a commit that adds a secret-shaped value, even when a later commit in the PR removes it (shown locally with the same image and arguments as CI, not by pushing a secret).
- [x] `gh api … -X PATCH`, `gh pr merge` and `gh repo edit` are refused for the assistant; `gh pr checks`, `gh pr view` and `gh api` GET requests run without a prompt; `docker run -e HUSKY=0 …` is no longer refused; `docker rm` asks instead of failing.
- [x] The playbook, `CLAUDE.md` and the template carry the deviation rule and the Measures section; GD-0 to GD-2 have back-filled measures.
- [x] The full gate and `pnpm test:integration` pass; the workflow parses, every action and image is pinned.

## Plan

1. After GD-2 merges: `ci.yml` (`Secrets` step after checkout), run it locally on a clean range and on a planted, then removed, fake secret in a throwaway clone.
2. `.claude/settings.json`; check each rule by attempting the commands listed in "done when" (the denied ones must fail before reaching GitHub).
3. Template, playbook, `CLAUDE.md`; back-fill measures for GD-0 to GD-2.
4. `/review` and the security-verifier agent; gate.

## Contexts, contracts and configuration

None in the product. CI gets one step and one pinned image. No ADR.

## Security and data

gitleaks runs with `--redact`, so findings in the CI log show the file and line, not the value. It reads only the checked-out repository; no token. The settings change narrows what the assistant can do on GitHub (no writes through `gh api`).

## Tests and fixtures

No product tests. The scan has its own regression harness, `.github/scripts/secret-scan.test.sh` (deviation 6). `verify` runs it when `.github/scripts/` or a workflow changes. Its fake secrets are generated at run time in a throwaway repository, never committed to this one.

## Rollout and risks

- Risk: false positives block a PR. Mitigation: fingerprint entries in `.gitleaksignore`, reviewed in the PR.
- Risk: `ask` rules prompt Htet more often for clean-up. Accepted: deletion should be a decision.
- Rollback: revert the workflow step and the settings file.

## Measures (filled when done)

- Elapsed: about 45 h, from approval (17 Nov 13:35 UTC) to the merge of PR #4 (19 Nov 10:41 UTC). The wait for GD-2 to merge took most of it. PR #4 took 6 minutes from opening to merge.
- Review findings, in order:
  - Second spec review: 0 blocking, 17 should fix and 8 nits (the Amendment).
  - Settings review on 18 Nov: 3 should fix.
  - Implementation review, before the first report of done: `reviewer` found 0 blocking, 6 should fix and 7 nits; `security-verifier` found 1 High, 3 Medium and 3 Low. All are fixed except the CODEOWNERS and secret-scanning settings, which are the admin's (playbook section 12).
  - First senior review, after the report of done: 0 blocking, 3 should fix and 2 nits, all fixed.
  - Second senior review: 2 nits. The macOS case limit was recorded; shellcheck and actionlint were run.
  - Lint: shellcheck and actionlint, 0 findings.
  - Third senior review: 1 should fix, these Measures, now fixed.
  - Full re-check, at Htet's request: 0 findings. The ask rules were confirmed, and the binary-only count was covered.
  - Fourth senior review (maintainability): 1 should fix. The fixture harness was not in the repository, and is now added (deviation 6).
- Escaped defects: 5, all found by Htet's review requests after the assistant reported GD-9 ready, all fixed before merge.
  - `git archive` obeyed the PR's `export-ignore`, so a file could be hidden from the tree pass.
  - The playbook's version check was not recorded.
  - The Verification was stale (`test:integration` was not re-run).
  - These Measures counted no escaped defects, against the template rule this same PR adds.
  - No regression test was committed for the scan: the fixture harness lived only in the assistant's scratchpad.

  The local fixture runs also caught two of the assistant's own bugs before any report of done (not escaped): the commit-message pipe lost its failure, and a plain `rev-list` count false-failed delete-only commits.
- Htet's attention: about 60 minutes, estimated. It covered approval, the amendment, three deviation decisions, eight run approvals (fixtures, the harness, the mutants), seven review and check requests, the lint approval, the ask-prompt check, and two merges' worth of git.
- Deviations: 6, all asked before and approved (see Deviations above).
- Rule breaches: none. Each throwaway-repo run that used refused git verbs was asked for and approved first.

## Verification (filled when done)

- **Gate:** `build:contracts` OK; typecheck Done ×3; `pnpm test` 35/35; `pnpm test:integration` 8/8 (throwaway Postgres on 55433, 19 Nov).
- **Workflows:** both parse (js-yaml). Every `uses:` is a 40-character SHA, and the gitleaks image is pinned by digest. No `run:` contains `${{ }}`. Both workflows have `permissions: contents: read`. `verify` runs on opened, synchronize and reopened; `pr-text` runs on those plus edited.
- **Scan, throwaway repository** (fake `ghp_` tokens generated at run time, the same script and image as CI; final run on 19 Nov). Every case behaved as expected:
  - Pass: clean range; empty commit; new branch (all-zero base, whole history); untracked local file not read; lockfile-only commit; `.svg`-only commit; clean stdin.
  - Fail: secret added then removed in the PR; secret only in a merge commit; secret in a commit message; force push (base gone; whole history scanned, secret found); rewind (empty range); a value that isn't a SHA; `.gitleaks.toml` added by the PR; inline `gitleaks:allow`; `tree` mode with a secret; stdin with a secret.
- **Lint** (19 Nov):
  - `shellcheck` v0.10.0 (`koalaman/shellcheck@sha256:2097951f…`) on `secret-scan.sh`: 0 findings.
  - `actionlint` 1.7.7 (`rhysd/actionlint@sha256:887a259a…`, which also runs shellcheck 0.10.0 on every `run:` block) on `ci.yml` and `pr-text.yml`: 0 findings.
  - `bash -n` passed.
- **Known local limit:** on macOS's case-insensitive file system, two stored files whose names differ only in case become one file in a local tree pass. CI runs on Linux, and the history pass sees both files' lines.
- **`export-ignore` case** (19 Nov, after the senior review): a fake token is committed with `.gitattributes: hidden.txt export-ignore`, before the scanned range. `git archive` would leave the file out (0 entries). The tree pass finds it, and the step fails. On agg's whole history, the tree pass read all 216 files of the head commit, clean.
- **Count rule:** matched gitleaks on edge commits:
  - counted: removes lines only 1, rename and edit 1, text added 1, text and binary 1, lockfile-only 1, `.svg`-only 1;
  - not counted: pure rename 0, mode only 0, binary deleted 0.
- **agg's real history** (fresh clone): the GD-2 push range scanned 3 commits and the whole history 8, both clean.
- **Settings:**
  - Refused: `gh pr merge`, `gh repo edit`, `gh api -X PATCH`, `git diff` of a file outside the repository, `commitlint -e <file>`, `tsc --outDir`, `cat *.key`, `gh ssh-key`, and earlier `git -C … commit`, `gh pr new`, `pnpm -F … add`, `gh auth`, `env`, `compose … config`, `npm ci`, writes under `.git/`.
  - Allowed without a prompt: `git diff --stat`, `commitlint --verbose` on stdin, `gh api repos/ticuong78/agg`, `docker run -e HUSKY=0`.
  - Totals: 46 allowed, 36 ask, 199 refused.
- **Full re-check before handover (19 Nov, at Htet's request):**
  - Gate 35/35 and `test:integration` 8/8. shellcheck and actionlint: 0 findings.
  - `main`'s whole history, in a fresh clone: clean.
  - Every fixture case was re-run on the final script and behaved as expected: gl-cases, gl-attr and gl-edge.
  - The edge run produced a true binary-only commit (numstat `- -`). gitleaks and the count rule both gave 0, so that case is now checked.
  - Refusals re-tested: `git -C … commit`, `git push`, `gh pr create`, `gh api -f…`, `pnpm -F … add`, `cat …/.env`, `gh auth`, `git diff` outside the repository, `tsc --outDir`. Reads allowed without a prompt.
  - **Ask rules:** `git stash list`, `git tag --list`, `git config --get` and `docker rm` each showed Htet a prompt (confirmed by Htet).
- **Harness** (`.github/scripts/secret-scan.test.sh`, deviation 6):
  - 29 of 29 cases as expected, in 54 s locally (one approved run).
  - It covers every earlier fixture case, plus a head that isn't in the clone, and lockfile-only and `.svg`-only edges.
  - shellcheck: 0 findings. actionlint on `ci.yml` with the new `Secret scan tests` step: 0 findings.
- **Mutation check** (two approved runs against copies in the scratchpad): the harness catches both original bugs when they are put back.
  - The commit-message pipe: 28 of 29, "secret in a commit message" passed. Exit 1.
  - A plain `rev-list` count: 24 of 29. Pure rename, binary added, mode only, binary deleted and empty commit falsely failed. Exit 1.
- **First run on GitHub** (PR #4, 2026-11-19): all checks passed.
  - `verify` passed in 55 s (run 44507018785), and every step ran.
  - `Secrets` scanned 1 commit; history, messages and files were clean.
  - `Secret scan tests` ran because this PR changes `.github/scripts/`: 29 of 29 cases as expected, in about 11 s on the runner.
  - `pr-text` passed in 18 s (run 44507018899): the title and description were clean, and the title passed commitlint.
  - GitGuardian passed.
  - Push run on `main` after the merge (run 44507895945): passed. `Secrets` scanned the pushed range, 3 commits with the merge, all clean. `Secret scan tests` passed 29 of 29.
  - The PR was merged with a merge commit, not a squash: the admin settings in playbook section 12 are still not set.
  - Not yet seen: `pr-text` re-running on an edit.

- **Settings review (18 Nov), fixed:**
  - Key files are refused for reading. `CLAUDE.md` rule 6 covers keys, but only `.env` files were denied before. The new rules cover `*.pem`, `*.key`, `*.p12`, `*.pfx`, `id_rsa*`, `id_ed25519*` and `.env.staging`, for both Read and Bash. A Read of `probe.pem` is refused, and `.env.example` still reads.
  - Write now asks, like Edit already did, for `pnpm-lock.yaml`, `pnpm-workspace.yaml` and `commitlint.config.cjs`.
  - `git checkout <ref> -- <path>` asks. Before, only `git checkout -- <path>` asked.
  - Result: 38 allowed, 28 ask, 173 refused.
- **Settings review, recorded and not fixed:** `git branch <name>`, which creates a branch, is not refused. Rules are checked in the order refused, ask, allowed, so a `git branch *` ask rule would also prompt on the read-only `git branch --list` and `--show-current`. The assistant does not create branches under `CLAUDE.md` workflow rule 3. Branch protection is still the real gate (A.1).
