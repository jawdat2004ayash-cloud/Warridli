# Historical archive: original Warridli planning specification

> Archived on 2026-10-29. The original planning document is preserved below, including initial proposals,
> environment observations and statements made before implementation. It is **not current project instructions**.
> Use the [project README](../../README.md), [current status](../STATUS.md), [API](../API.md) and [ERD](../ERD.md)
> for the implemented project. Original paths and commands describe the repository root at that time.
> The companion [Claude Code planning instructions](CLAUDE.md) are also historical.

---

# Warridli (ورّدلي) — persistent project instructions

> This file is a planning/quality handoff for Claude Code. The founder has not approved implementation yet. **Start in Plan Mode, audit requirements and environment, write a phased implementation plan, then ask for approval before making project files or code.**

## Product and audience

Warridli is a **mobile-first Arabic RTL B2B RFQ marketplace** serving maintenance departments, small factories and workshops and local suppliers in Damascus / Rural Damascus, Syria. It is **not** a consumer marketplace, general ecommerce catalog, logistics business, payment intermediary, or technical compatibility certifier. Its value is **speedy, useful, verifiable supplier quotes for urgently needed industrial maintenance parts**.

A buyer creates a private RFQ with one or more requested parts: photo, free-text description, any visible part number, machine make/model, requested quantity, locality, optional category, urgency and notes. **Never assume a buyer knows technical part terminology:** allow unknown category and manual admin triage. Suppliers subscribe to verified specialty categories, see only RFQs they are eligible/approved to receive, and submit **private** quotes with price, currency, brand, declared origin, stock status, lead time, fulfillment option and valid-until. Buyer compares quotes and contacts supplier directly (e.g. WhatsApp deeplink). Neither platform nor developer collects merchandise payment, arranges transportation, guarantees part compatibility or promises product authenticity.

Initially support only a few commonly requested maintenance categories (bearing, belts, seals/couplings) as hypotheses; validate actual category choice with 10+ buyers and 15+ suppliers first. Do not invent taxonomy, specs, local demand, or business outcomes as facts.

## Current local environment (observed October 2026)

Windows 11, VS Code, Chrome, Postman, PHP Intelephense, Laravel Herd, PHP 8.5.12, Composer 2.10.3, Node.js 24.21.0, npm 11.19.0, Git 2.55.0.windows.5, Laravel Installer 5.32.0, DBeaver. XAMPP's MariaDB 10.4.32 currently responds locally at 127.0.0.1:3306, using root without a password in the observed dev-only installation; **this MariaDB version has been out of maintenance since June 2024.** Never deploy it publicly. Do not delete, modify, or migrate existing local databases `test`, `we_login_system`, or `phpmyadmin`. Prefer a separately configured supported MariaDB LTS or MySQL LTS, initially using a separate port if necessary; ensure development and target engine/version compatibility. Ask for approval before server/version changes. Do not expose root or passwordless DB access beyond localhost; create a dedicated least-privilege project database user.

Composer `diagnose` showed missing Composer self-update verification public keys (not a proven blocker for package installation). Do not bypass verification or fetch unverified keys; fix from official documentation if needed.

## Architecture and maintainability

Default to a **modular monolith**, not microservices:
- `backend/`: supported Laravel version with REST API, FormRequests for validation, Policies for ownership/authorization, action/service classes for actual business workflows, queues for notifications, migrations and factories, focused feature/unit tests.
- `frontend/`: React + Vite + TypeScript, explicit routing, accessible Arabic RTL components, responsive/mobile-first design and user-friendly server-state/error handling. Bootstrap is known to the founder but do not let default Bootstrap styling define the visual identity; use restrained, custom design tokens and component styles.
- Supported relational DB (MariaDB/MySQL) with foreign keys, unique constraints, indexes informed by query patterns, and migrations. Suggested entities (finalize during ERD review): users, companies, company_members, supplier_profiles, categories, supplier_categories, rfqs, rfq_items, rfq_attachments, quotes, quote_items, notifications, contact_events, audit_logs. Minimize unnecessary tables for MVP while preserving proper ownership relationships.
- Laravel Sanctum SPA cookie-based auth if SPA/API are same-site and configured correctly; CSRF protection, secure cookies, server-side policy checks. Never trust frontend role checks alone. Design for multi-person companies rather than one ambiguous global role, but keep MVP roles manageable.
- No premature distributed components. Introduce Redis/background workers only when use case and measurements justify them. Queue notifications when useful. Paginate list endpoints, avoid N+1, index common filters, instrument slow queries. Use transactions/unique constraints for offer creation and idempotent state transitions where appropriate.
- Preserve quote currency/unit and valid-until; avoid stale prices and unsupported compatibility promises. Buyer-only quote visibility. Supplier cannot access competing quotes. Admin routes require authorization and logging.

## Design quality bar (do not generate generic AI-looking dashboards)

Aim for **specific, credible, industrial-procurement product design**, not a common gradient-purple SaaS template. Before writing components, propose a small visual direction: logo wordmark draft, intentional Arabic typography (legally licensed fonts), sober tailored palette, typographic scale, spacing tokens, icon vocabulary, RTL-aware navigation, responsive breakpoints, skeleton/empty/error/success states. No stock hero of warehouses, no gratuitous gradient cards, no excessive drop shadows, no meaningless charts, no interchangeable placeholder marketing copy. Make RFQ creation and supplier quote comparison exceptionally clear. Support touch sizes, keyboard navigation, contrast, screen readers. Realistic Arabic copy. Use consistent cohesive UI details, test with browser at phone and desktop sizes, inspect screenshots/DOM and iterate.

## Security and correctness gates

- Validate every payload, price, quantity, currency and file size/type on the **server**; restrict uploads to permitted image types, generated filenames, private storage where warranted, and authenticated retrieval.
- Prevent IDOR: buyer can only modify their RFQs and view their quote results; supplier sees only matching RFQs and its **own** quotes; no supplier quote leakage; admin access audited.
- Rate limiting on auth, RFQ creation, and quote submission; CSRF and XSS protections; SQL parameterization; no raw secrets or `.env` in Git; password hashing and password reset flows.
- Use environment-specific config, HTTPS on eventual deployment, least-privilege DB accounts, safe backups and tested restore procedure.
- Database migration down/up safety: never run destructive reset commands on preexisting user databases. Seed only project's isolated development database.
- Provide positive and negative tests of permissions, quote access, RFQ states, input validation, uploads, and edge cases; lint, typecheck, test, build must pass. Agent must **run** commands and report outputs accurately, not claim passing tests without execution.
- Handle failures, transactional consistency, concurrency where relevant, and error logging. Performance and scalability claims require measured tests against a production-like environment; do not claim the app supports 'thousands of users' just because it compiles.

## Scope for academic MVP

Features: buyer registration, supplier registration + admin moderation, company profiles, category management, RFQ create/list/details with photos and unknown category manual triage, category-based targeting, supplier quote submission, buyer quote comparison, quote expiry, status transitions, in-app notifications, WhatsApp contact link, admin moderation and basic metrics. Make reasonable default decisions, document assumptions.

Explicitly **out of scope** for MVP: online payments, inventory catalog, order fulfillment and delivery, shipment tracking, native mobile apps, complex real-time chat, AI part identification, automated technical fit guarantees, subscription billing integration, ERP/CRM integrations, microservices. Supplier subscriptions are a later manually validated feature; avoid building a payment system now.

## Workflow and budget

The founder has restricted Claude weekly quota (~45% reportedly remaining until Thursday). Conserve usage. Work in small vertical slices rather than asking Claude to build everything at once. Suggested milestones:

0. **Plan first (no code)**: assumptions, requirement clarifications only if material, user journeys, UX wireframes/page inventory, ERD, lifecycle/state model, API contracts, risk/abuse cases, MVP definition, implementation order and acceptance criteria. Record in `docs/` only after approval.
1. Scaffold backend/frontend, environment checks, tests and a custom visual design system.
2. Authentication, company ownership, supplier vetting and authorization tests.
3. Full vertical RFQ workflow: buyer posts part -> match/triage -> supplier quotes -> buyer compares -> contacts supplier; include negative tests.
4. Admin panel, notifications, responsive polish and user flows.
5. Security review, accessibility/RTL review, integration + browser tests, query plans, pagination, backup/restore notes, deployment instructions, final acceptance.

After each milestone: run relevant tests; summarize working functionality, changed files, commands/tests and results, known issues, next milestone. Commit a small coherent change to Git after user approval or in accordance with approved git rules. Maintain `docs/STATUS.md` and `docs/DECISIONS.md` so context survives fresh Claude sessions and usage resets. Do not spawn agent teams, install many plugins/MCPs, or scan entire repo repeatedly without clear payoff. Prefer focused prompts, clear context, and read-only plan review before expensive coding. Use `/usage`, `/context`, `/clear`, and `/compact` appropriately.

## Local operational boundaries

Work only inside a newly created dedicated `Warridli` project directory. Do not read unrelated personal files, export local databases or make unauthorized network calls. Ask approval for global installations, modifying XAMPP/Herd settings, database upgrades, payments, deleting files, public deployment, setting credentials, or any destructive command. Do not use permissions bypass mode on this personal laptop. Use `acceptEdits` or appropriately constrained approvals, and review diffs.

## Important communication preferences

The founder is a recent full-stack diploma graduate, so explain concise instructions in accessible **colloquial Syrian Arabic**, with English technical labels as needed. The end-user UI should use clear professional Arabic with RTL support. Avoid overloading the founder with dozens of manual setup steps. The goal is a verifiable, solid graduation MVP and an honest business experiment, not a flashy demo or an impossible production guarantee.
