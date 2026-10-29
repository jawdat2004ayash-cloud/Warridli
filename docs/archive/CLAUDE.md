# Historical archive: Claude Code planning instructions

> Archived on 2026-10-29. The original planning document is preserved below as development provenance,
> including its early "implementation not approved" language. It is **not current project instructions**.
> Use the [project README](../../README.md), [current status](../STATUS.md) and [decisions](../DECISIONS.md).
> Original paths and environment descriptions refer to the repository as it existed during planning.
> The companion [historical specification](WARRIDLI_SPEC.md) is archived alongside this document.

---

# Warridli (ورّدلي) — instructions for Claude Code

**Before any code:** read `WARRIDLI_SPEC.md` and use Plan Mode. The founder has NOT approved implementation. Propose a phased plan and get approval for the first milestone. Speak to the founder in concise, clear Syrian Arabic.

## Objective
A trustworthy mobile-first Arabic RTL B2B request-for-quotation application for workshops, factories, and industrial maintenance suppliers in Damascus and Rural Damascus. Prioritize fast useful quotes for needed parts, not a generic online store. Unknown technical terminology must be handled: allow photo, part/model number, free text, and unknown category/manual triage. No product payment, shipping, AI part-identification promises, compatibility guarantees, or massive catalog in MVP.

## Implementation quality
- Prefer a modular Laravel monolith API, React + Vite + TypeScript, and supported MariaDB/MySQL, with clear ownership, policies and tests. Avoid unnecessary infrastructure and microservices.
- Build an original, precise industrial procurement design, not a generic AI SaaS template. Professional Arabic copy, RTL, responsive UX, accessibility, robust empty/error/loading states. Use browser checks and iterate.
- Backend authorization is mandatory on every restricted endpoint. Suppliers may not see competitors' quotes; buyers see only their own requests/quotes. Server-side validation, safe private file uploads, CSRF/session security, rate limiting, audit trail, safe migrations, no secrets in Git.
- Test actual outcomes: authentication, permissions, upload validation, RFQ lifecycle, quote visibility, endpoints and frontend workflows. Typecheck, lint, test and build before declaring a milestone done. No unmeasured production performance claims.
- Preserve data consistency with proper foreign keys, constraints, indexes, transactions when needed; paginate lists and avoid N+1.

## Local environment and boundaries
Windows 11, VS Code, Herd with PHP 8.5.12, Composer 2.10.3, Node 24.21.0/npm 11.19.0, Git 2.55, Laravel installer 5.32, XAMPP running MariaDB 10.4.32 (out of maintenance), DBeaver, Chrome, Postman. Old XAMPP databases `test`, `we_login_system`, and `phpmyadmin` MUST NOT be modified. Use an isolated project folder, separate database/schema, dedicated non-root user, ideally a maintained server version. Never expose passwordless root DB or deploy unsupported MariaDB 10.4.
Do not perform destructive commands, global installs, system changes, public deployments, payments, or reads outside project without explicit approval. Do not use `bypassPermissions` on the founder's laptop.

## Token-budget workflow
Weekly Claude limit is constrained (reportedly ~45% remains). Work in *small, verified vertical slices*; no endless parallel agents or unnecessary dependencies. Follow the plan in `WARRIDLI_SPEC.md`. Keep `docs/STATUS.md` and `docs/DECISIONS.md` updated at milestone boundaries, commit coherent completed work to Git when approved. Summarize what's done, tests actually run, blockers, and the next action. Use fresh sessions for new milestones rather than forcing one massive conversation.
