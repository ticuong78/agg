---
name: security-audit
description: Run a lead-and-verifier security audit of agg (GóiĐề): API access, identity, conversion isolation, uploads and archives, exports, payment webhooks, AI adapters, operations. Records findings under docs/security.
---

# Security audit

Two roles. You are the lead; the `security-verifier` agent independently re-checks every finding. A finding is reported only with evidence (file and line, or a reproduced request).

## Lead procedure

1. Scope from the code, not from memory: list every route in `apps/api/src/modules/*/presentation/*.ts` and `apps/api/src/health.controller.ts` with its `@Access` level, every repository method that loads or lists by id, every Claude adapter, the document reader, the exporters, `apps/api/src/config/environment.ts`, `docker-compose.yml`, `deploy/`, the `.env.example` files (never `.env`), `.github/workflows` if present.
2. Check each area against the questions below. Record each candidate finding as: id, severity (Critical, High, Medium, Low), area, evidence (path:line), impact, fix, effort.
3. Hand the candidate list to the `security-verifier` agent. Keep only findings it marks Confirmed; findings marked Needs runtime are listed separately as "to verify by running".
4. Write `docs/security/audit-<YYYY-MM-DD>.md` with: scope, method, confirmed findings, unverified items, and the top five fixes in order. Create one spec per Critical or High finding.

## Questions per area

Access: routes without `@Access` (the guard should refuse them) or with a wider level than needed; routes outside the MVP reachable when the MVP switch is on (GD-3).

Identity: brute-force protection on sign-in code requests and checks; codes hashed, expiring, attempt-limited; JWT lifetime and secret checks; admin determined only by `ADMIN_EMAILS`; email enumeration.

Conversion isolation: every load and list checked with `Conversion.canBeOpenedBy`; guest access keys stored only as SHA-256 and compared safely; 404 rather than 403; guest allowances by visitor and hashed IP; retention sweeper deleting on time.

Uploads and archives: magic-byte checks in `source-file.ts`; size and file-count limits from `plans.ts`; docx and pdf parsing limits (pages, zip entries, decompressed size); test zip import (GD-5): zip slip, symlinks, zip bombs, entry count, text only; originals never written to disk or the database.

Exports: task codes and file names safe as Themis paths; no path traversal in the `.contest` zip; markdown and LaTeX rendering in the web app (XSS).

Payments: webhook checks per gateway (Stripe, VNPay and MoMo signatures; VietQR confirmed by the SePay-format webhook's `Apikey`, `SEPAY_WEBHOOK_KEY`); an order paid once at the right amount (`Order.markPaid`).

Logging and privacy: no emails, sign-in codes, tokens, access keys or uploaded content in logs (the dev mail transport prints mails only when SMTP is not configured, which production refuses); analytics stored only with `analyticsConsent`; lead CSV export limited to people who agreed to marketing; every retention period on the privacy page matches `plans.ts`, the sweepers and log settings.

AI adapters: prompt injection from uploads and instructions; zod validation; link filtering; behaviour with no key; credits not spent on failure; personal data sent to the model.

Operations: secrets in git history (the repository is public); `DB_SYNC` in production; CORS origins; `TRUST_PROXY`; dependency pinning and the lockfile; CI gates; Docker images and Caddy limits.

## Severity guide

Critical: unauthenticated access to another person's data, or code execution. High: cross-tenant read or write, missing auth on a mutating route, a payment marked paid without a valid signature. Medium: brute-force, enumeration, missing limits with a clear abuse path. Low: hardening gaps with no direct exploit.
