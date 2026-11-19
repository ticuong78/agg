#!/usr/bin/env bash
# GD-9: secret scan with gitleaks, run by CI (ci.yml `Secrets`, pr-text.yml) and the same way locally.
#
#   secret-scan.sh range FROM TO   every commit in FROM..TO with its patch (merges included, as the change they bring
#                                  to their first parent), the commit messages, and the files stored in TO (read from
#                                  git, so untracked files such as a local .env are never read).
#                                  FROM all zeros, or missing after a force push: the whole history of TO.
#   secret-scan.sh stdin           text on standard input (the PR title and description).
#   secret-scan.sh tree            the files under the current directory (the assistant's pre-handover scan: run it in
#                                  a temporary copy of the files to be committed, never in a tree with .env files).
#
# Fails closed: gitleaks prints "no leaks found" and exits 0 when git refuses the repository (it then scans 0
# commits), so the history scan must report exactly as many commits as git counts with changes in the same range.
# The rules are gitleaks' built-in ones only: a .gitleaks.toml or .gitleaksignore in the repository, or an inline
# `gitleaks:allow`, would let a PR switch off its own scan, so the first fails the step and the others are ignored.
# The log shows only the rule, file, line and commit of a finding: never the value (--redact) or the author's email.
set -euo pipefail

image="${GITLEAKS_IMAGE:?set GITLEAKS_IMAGE to the gitleaks image pinned by digest}"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/reports"
failed=0

fail() { echo "::error::Secrets: $1"; failed=1; }

# $1 = report name, $2 = directory mounted read-only as /repo, then the gitleaks command and its arguments.
# Prints gitleaks' summary (never a finding's value) and keeps it in $out.
gitleaks() {
  local name="$1" src="$2"; shift 2
  local status=0
  out="$(docker run --rm -i --user "$(id -u):$(id -g)" \
    -e GIT_CONFIG_COUNT=1 -e GIT_CONFIG_KEY_0=safe.directory -e GIT_CONFIG_VALUE_0=/repo \
    -v "$src:/repo:ro" -v "$work/reports:/out" -w /repo "$image" \
    "$@" --no-banner --no-color --redact --exit-code 2 --ignore-gitleaks-allow --gitleaks-ignore-path /out \
    --report-format json --report-path "/out/$name.json" 2>&1)" || status=$?
  printf '%s\n' "$out" | sed "s/^/  [$name] /"
  if [ "$status" -eq 2 ]; then
    fail "$name: secret-shaped values found (values redacted):"
    # File names are JSON-escaped: a name with a newline cannot start a "::" workflow command in the log.
    jq -r '.[] | "  \(.RuleID)  \(.File | @json):\(.StartLine)  \(.Commit[0:12])"' "$work/reports/$name.json"
  elif [ "$status" -ne 0 ]; then
    fail "$name: gitleaks did not finish (exit $status)"
  fi
}

# $1 = directory to check. gitleaks would load these from the scanned directory and obey them.
no_repo_config() {
  local f
  for f in .gitleaks.toml .gitleaksignore; do
    if [ -e "$1/$f" ]; then
      fail "$f found: the scan uses gitleaks' built-in rules only, so a PR cannot change them (GD-9)"
      exit 1
    fi
  done
}

case "${1:-}" in
  range)
    from="${2:-}"; to="${3:-}"
    # Only SHAs reach git and docker: the values come from the event through env, never pasted into a script.
    [[ "$to" =~ ^[0-9a-f]{40}$ ]] || { fail "the head is not a 40-character SHA"; exit 1; }
    [[ "$from" =~ ^[0-9a-f]{40}$ ]] || { fail "the base is not a 40-character SHA"; exit 1; }
    git cat-file -e "${to}^{commit}" 2>/dev/null || { fail "the head $to is not in this clone"; exit 1; }
    if [[ "$from" =~ ^0+$ ]] || ! git cat-file -e "${from}^{commit}" 2>/dev/null; then
      range="$to"
      echo "Scanning the whole history of $to (new branch, or the old head is gone after a force push)."
    else
      range="$from..$to"
    fi
    # A rewind to an ancestor leaves nothing to scan; failing is safer than a green check that scanned nothing.
    [ "$(git rev-list --count "$range")" -gt 0 ] || { fail "$range has no commits, so nothing can be scanned"; exit 1; }

    # The files of TO, read blob by blob. Not `git archive`: it obeys the PR's own .gitattributes, so `export-ignore`
    # could hide a file from this pass and `export-subst` could rewrite one.
    mkdir "$work/tree"
    git ls-tree -r -z "$to" > "$work/tree.list"
    while IFS= read -r -d '' entry; do
      read -r _mode type blob <<< "${entry%%$'\t'*}"
      path="${entry#*$'\t'}"
      [ "$type" = blob ] || continue # submodule commits have no content here
      mkdir -p "$work/tree/$(dirname "$path")"
      git cat-file blob "$blob" > "$work/tree/$path"
    done < "$work/tree.list"
    no_repo_config "$work/tree"
    no_repo_config "$PWD"

    # gitleaks counts a commit only when its diff (against the first parent, for merges) changes lines in a file that
    # is not deleted. Not counted: empty commits, commits that only delete files, pure renames, mode-only changes,
    # binary-only changes. Count the same way; any mismatch fails, so a wrong guess here fails closed. When both
    # counts are 0 (a PR of such commits), there is no added content to scan, and the step passes.
    expected="$(git log --diff-merges=first-parent --diff-filter=d --format='@%H' --numstat "$range" |
      awk '/^@/ { sha = $0; next } NF && $1 != "-" && $1 + $2 > 0 && !(sha in seen) { seen[sha] = 1; n++ }
           END { print n + 0 }')"

    gitleaks history "$PWD" git --log-opts="--diff-merges=first-parent $range"
    scanned="$(printf '%s\n' "$out" | sed -nE 's/.* ([0-9]+) commits? scanned.*/\1/p' | tail -1)"
    if [ "${scanned:-none}" != "$expected" ]; then
      fail "gitleaks scanned ${scanned:-no} commits, git counts $expected with changes in $range"
    fi

    # Through a file, not a pipe: a pipe would run the scan in a subshell and lose its failure.
    git log --format=%B "$range" > "$work/messages.txt"
    gitleaks messages "$PWD" stdin < "$work/messages.txt"
    gitleaks tree "$work/tree" dir /repo
    ;;
  stdin)
    # An empty directory as /repo, so no repository config can be picked up.
    mkdir "$work/empty"
    gitleaks text "$work/empty" stdin
    ;;
  tree)
    no_repo_config "$PWD"
    gitleaks tree "$PWD" dir /repo
    ;;
  *)
    echo "usage: secret-scan.sh range FROM TO | secret-scan.sh stdin | secret-scan.sh tree" >&2
    exit 64
    ;;
esac

exit "$failed"
