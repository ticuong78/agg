# ADR 0001: Record architecture decisions

Date: 2026-11-17
Status: accepted

## Context

The project is built quickly with an AI assistant. Decisions that are not written down get re-decided, often differently, in the next session. agg starts with the same rule as OnlineJudge (its ADR 0001).

## Decision

Every decision that constrains future work (a boundary, a storage choice, a security trade-off, a dependency) is recorded here as `NNNN-<slug>.md` with Context, Decision and Consequences. The first ones to write: migrations instead of `DB_SYNC` (GD-1), the MVP off-switch (GD-3), and one Themis settings writer per tested version (GD-8).

## Consequences

Reviewers can point to a record instead of re-arguing; the assistant finds them through `CLAUDE.md` (Workflow 1), the playbook and the spec template's ADR prompt; changing a decision means a new record that supersedes the old one.
