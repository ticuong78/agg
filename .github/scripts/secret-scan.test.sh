#!/usr/bin/env bash
# GD-9: regression tests for secret-scan.sh. They build a throwaway repository in a temporary directory, plant fake
# tokens generated at run time (no secret-shaped literal lives in this file), and check every case passes or fails as
# it should. CI runs this in `verify` whenever .github/scripts or .github/workflows changes, so a script edit or a new
# gitleaks digest is re-checked, above all the commit-count rule, which copies how gitleaks counts commits.
#
#   GITLEAKS_IMAGE=ghcr.io/gitleaks/gitleaks@sha256:... bash .github/scripts/secret-scan.test.sh
#
# Needs docker, git and jq. git runs isolated from the user's configuration (no signing, hooks or aliases).
set -uo pipefail

: "${GITLEAKS_IMAGE:?set GITLEAKS_IMAGE to the gitleaks image pinned by digest}"
SCAN="$(cd "$(dirname "$0")" && pwd)/secret-scan.sh"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
log="$tmp/case.log"
wrong=0
total=0

export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
export GIT_AUTHOR_NAME=fixture GIT_AUTHOR_EMAIL=fixture@example.invalid
export GIT_COMMITTER_NAME=fixture GIT_COMMITTER_EMAIL=fixture@example.invalid

# A GitHub-token-shaped value, new on every run.
fake() { printf 'ghp_%s' "$(LC_ALL=C tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 36)"; }
commit() { git add -A && git commit -q -m "$1" && git rev-parse HEAD; }

# $1 = pass|fail, $2 = label, then the arguments to secret-scan.sh. The scan's output is shown only for a wrong
# result; it never holds a value (--redact).
check() {
  local want="$1" label="$2" got; shift 2
  total=$((total + 1))
  if "$SCAN" "$@" > "$log" 2>&1; then got=pass; else got=fail; fi
  if [ "$got" = "$want" ]; then
    echo "ok     $label"
  else
    echo "WRONG  $label (want $want, got $got)"; sed 's/^/         /' "$log"; wrong=$((wrong + 1))
  fi
}
# Same, with standard input for `stdin` mode.
check_stdin() {
  local want="$1" label="$2" text="$3" got
  total=$((total + 1))
  if printf '%s\n' "$text" | "$SCAN" stdin > "$log" 2>&1; then got=pass; else got=fail; fi
  if [ "$got" = "$want" ]; then echo "ok     $label"; else
    echo "WRONG  $label (want $want, got $got)"; sed 's/^/         /' "$log"; wrong=$((wrong + 1)); fi
}

repo="$tmp/repo"; mkdir "$repo"; cd "$repo" || exit 1
git init -q -b main
echo "fixture" > README.md; BASE=$(commit "chore: base")

git switch -qc clean; echo "ok" > a.txt; CLEAN=$(commit "feat: clean change")

git switch -q main; git switch -qc add-remove
echo "token: $(fake)" > leak.txt; commit "feat: add config" > /dev/null
git rm -q leak.txt; ADDREM=$(commit "fix: remove config")

git switch -q main; git switch -qc side; echo "side" > s.txt; commit "feat: side" > /dev/null
git switch -q main; git switch -qc merge-secret
git merge -q --no-ff --no-commit side > /dev/null 2>&1; echo "token: $(fake)" > merged.txt; MERGE=$(commit "Merge branch 'side'")

git switch -q main; git switch -qc msg-secret; echo "m" > m.txt; git add m.txt
git commit -q -m "feat: change" -m "debug token $(fake)"; MSG=$(git rev-parse HEAD)

git switch -q main; git switch -qc empty; git commit -q --allow-empty -m "chore: empty"
EMPTY=$(git rev-parse HEAD)

git switch -q main; git switch -qc lockfile
printf 'lockfileVersion: 9.0\nsettings:\n  autoInstallPeers: true\n' > pnpm-lock.yaml; LOCKBASE=$(commit "chore: lock")
printf 'lockfileVersion: 9.0\nsettings:\n  autoInstallPeers: false\n' > pnpm-lock.yaml; LOCK=$(commit "chore(deps): relock")
printf '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>\n' > icon.svg
SVG=$(commit "feat: icon")

git switch -q main; git switch -qc config
printf "[allowlist]\npaths = ['''.*''']\n" > .gitleaks.toml; echo "token: $(fake)" > c.txt; CONFIG=$(commit "chore: config")

git switch -q main; git switch -qc allow
echo "token: $(fake) # gitleaks:allow" > al.txt; ALLOW=$(commit "chore: allow")

# A secret committed before the scanned range, hidden from `git archive` by export-ignore: only the tree pass sees it.
git switch -q main; git switch -qc attrs
printf 'hidden.txt export-ignore\n' > .gitattributes; echo "token: $(fake)" > hidden.txt; ATTR_A=$(commit "chore: attrs")
echo "ok" > after.txt; ATTR_B=$(commit "feat: after")

# One-commit ranges whose count gitleaks and the script must agree on (a mismatch fails the scan).
git switch -q main; git switch -qc edge
printf 'one\ntwo\nthree\nfour\n' > lines.txt; commit "feat: lines" > /dev/null
edge() { # label, then the shell command that makes the change
  local before; before=$(git rev-parse HEAD); eval "$2"; local after; after=$(commit "chore: $1")
  check pass "count: $1" range "$before" "$after"
}
edge "only removes lines" "printf 'one\nfour\n' > lines.txt"
edge "pure rename"        "git mv lines.txt renamed.txt"
edge "rename and edit"    "printf 'one\nfour\nfive\n' > renamed.txt; git mv renamed.txt moved.txt"
edge "binary added"       "printf 'a\0b\0c' > blob.bin"
edge "mode change only"   "chmod +x moved.txt"
edge "binary deleted"     "git rm -q blob.bin"
edge "text and binary"    "printf 'six\n' >> moved.txt; printf 'd\0e' > b2.bin"
edge "lockfile only"      "printf 'lockfileVersion: 9.0\n' > pnpm-lock.yaml"
edge "svg only"           "printf '<svg xmlns=\"http://www.w3.org/2000/svg\"/>\n' > icon.svg"

git switch -q clean
GONE=$(LC_ALL=C tr -dc 'a-f0-9' < /dev/urandom | head -c 40)
ZERO=0000000000000000000000000000000000000000

check pass "clean range"                                  range "$BASE" "$CLEAN"
check fail "secret added then removed in the range"       range "$BASE" "$ADDREM"
check fail "secret only in a merge commit"                range "$BASE" "$MERGE"
check fail "secret in a commit message"                   range "$BASE" "$MSG"
check pass "empty commit"                                 range "$BASE" "$EMPTY"
check pass "new branch: whole history"                    range "$ZERO" "$CLEAN"
check fail "force push: old head gone, history has one"   range "$GONE" "$ADDREM"
check fail "rewind: empty range"                          range "$CLEAN" "$BASE"
check fail "head is not a SHA"                            range "$BASE" 'HEAD;touch /tmp/x'
check fail "head is not in the clone"                     range "$BASE" "$GONE"
check pass "lockfile-only commit"                         range "$LOCKBASE" "$LOCK"
check pass "svg-only commit"                              range "$LOCK" "$SVG"
check fail "export-ignore cannot hide a file"             range "$ATTR_A" "$ATTR_B"
check fail "inline gitleaks:allow is ignored"             range "$BASE" "$ALLOW"
git switch -q config
check fail "a .gitleaks.toml in the PR fails the step"    range "$BASE" "$CONFIG"
git switch -q clean
echo "token: $(fake)" > untracked.txt
check pass "an untracked local file is not read"          range "$BASE" "$CLEAN"
rm untracked.txt

mkdir "$tmp/files"; cd "$tmp/files" || exit 1
echo "plain text" > notes.txt
check pass "tree: clean files"                            tree
echo "token: $(fake)" > found.txt
check fail "tree: a secret in a file"                     tree

check_stdin pass "stdin: clean title and description" "$(printf 'feat: title\n\nplain description')"
check_stdin fail "stdin: a secret in the description"  "$(printf 'feat: title\n\nsee %s' "$(fake)")"

echo
echo "$((total - wrong)) of $total cases as expected"
[ "$wrong" -eq 0 ]
