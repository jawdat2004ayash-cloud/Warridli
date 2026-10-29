# Warridli · ورّدلي

An Arabic RTL web application for industrial spare-part requests for quotation, built as a **Full Stack
Development diploma graduation project** for workshops, factories and suppliers in Damascus and Rural Damascus.

A buyer describes one needed part using text, a part number or a photo. Approved suppliers with matching
specialties receive the request and submit private quotes. The buyer compares offers and selects a quote;
the selected supplier receives an in-app notification.

## Key features

- **Buyers:** company registration, categorized RFQs or unknown-category requests for manual triage,
  private photos, quote comparison by currency, explicit supplier contact disclosure and quote selection.
- **Suppliers:** company and specialty approval, a matching RFQ inbox, quote submission/editing/withdrawal
  and in-app notifications. Suppliers cannot view competitors' quotes.
- **Administration:** supplier and specialty moderation, RFQ triage, categories, suspension controls,
  operational metrics and an audit trail.
- **Engineering:** Laravel policies and server validation, Sanctum sessions/CSRF, private re-encoded uploads,
  transactional workflow changes, pagination, Arabic RTL layouts, keyboard support and lazy route loading.

This is a local diploma MVP. There is no public deployment, inventory catalog, payment or delivery integration,
AI part identification or guarantee of technical compatibility. See [release limitations](docs/RELEASE_READINESS.md).

## Technology

| Layer | Versions verified in the local handoff |
|---|---|
| Backend | Laravel 13.38.0, Sanctum 4.3.3, PHP 8.5.12, Composer 2.10.3 |
| Frontend | React 19.3.1, TypeScript 6.0.3, Vite 8.3.5, Node 24.21.0, npm 11.19.0 |
| Database | MariaDB 11.4.13 LTS, InnoDB, utf8mb4 |
| Quality checks | Pest, Pint, Larastan, Vitest, oxlint, Playwright with installed Chrome |

Use PHP 8.5 and Node 24.21+ in the 24.x line for the verified development setup. Locked production PHP
dependencies require at least PHP 8.4.1 despite the root `^8.3` constraint. Enable `pdo_mysql` and GD with
JPEG/PNG/WebP; EXIF supports photo orientation. Keep both lockfiles. No Redis, Docker or Laravel Boost is required.

## Quick start — a new instructor lab

Use a **new checkout and new empty databases**, not the owner's working installation. The
[detailed instructor setup](docs/HANDOFF.md#instructor-local-setup) covers database provisioning, environment
templates, key generation, reference seeds and an admin account with a hidden password prompt.

1. Install the prerequisites above and MariaDB 11.4.x. Local database tests require **127.0.0.1:3307**.
2. Install locked dependencies from the new checkout:

   ```powershell
   Set-Location backend
   composer install --no-interaction
   Set-Location ../frontend
   npm ci
   Set-Location ..
   ```

3. Follow the detailed setup to create separate empty `warridli_instructor` and `warridli_test` schemas,
   configure credentials privately and verify the live target **before** migrations or reference seeding.
   No database dump, fixed login or secret is supplied.
4. After setup, start the application in separate terminals:

   ```powershell
   # Terminal 1, from backend/
   php artisan serve --host=127.0.0.1 --port=8000
   # Terminal 2, from frontend/
   npm run dev -- --host 127.0.0.1
   ```

Open **http://localhost:5173**. Vite proxies API/session requests to Laravel; keep that browser hostname
consistent. Optional scheduler and queue-worker instructions are in the detailed setup.

Never run `composer setup`, `migrate:fresh`, `db:wipe`, a reset or a restore against an existing database.
Do not overwrite existing environment files or regenerate an existing `APP_KEY`. Generated
`backend/AGENTS.md` / `backend/CLAUDE.md` scaffold instructions to install Boost are not project requirements.

## Verified results

The final local handoff on **2026-10-29** recorded:

| Check | Result |
|---|---|
| Backend | Pint passed; Larastan 0 errors; **293/293 Pest tests, 1,541 assertions** |
| Frontend | TypeScript, oxlint and production build passed; **127/127 Vitest tests in 14 files** |
| Browser | **52/52 Playwright tests, 0 skipped**, desktop/mobile Chrome, 4.1 minutes |
| Core manual journey | Buyer registration → categorized bearing 6205-2RS RFQ → matching supplier quote → buyer selection → supplier notification |

Supplier and specialization approval were manually tested earlier. The owner confirmed both M5c development
migrations as **Ran**. [STATUS](docs/STATUS.md) records the evidence and scope; this documentation cleanup
does not claim a new test run or manual verification of every flow.

For reruns, follow the [live test preflight](docs/HANDOFF.md#test-preflight). `composer check` runs backend
checks; `npm run check` runs frontend checks; `npm run e2e` runs browser checks after a build, with Chrome
and ports 8020/5174 available. Database-writing tests may rebuild **only `warridli_test:3307`**.
Never run Pest and Playwright concurrently. Browser-test credentials come from `backend/.env` or process
variables, not `.env.testing`; use the dedicated lab credentials described in the setup.

## Instructor demonstration

Use the [demonstration checklist](docs/HANDOFF.md#suggested-1015-minute-instructor-demonstration) with
synthetic accounts and photos. Publication-ready screenshots are not included. Any later captures should
use synthetic data and exclude credentials and private details.

## Documentation

| Location | Contents |
|---|---|
| `backend/` and `frontend/` | Laravel API and React SPA, with their existing tests |
| [API](docs/API.md) · [ERD](docs/ERD.md) | API contract and relational data model |
| [Handoff](docs/HANDOFF.md) | Detailed setup, guarded testing, demonstration and source packaging |
| [Deployment](docs/DEPLOYMENT.md) · [Backup/restore](docs/BACKUP_RESTORE.md) | Operational procedures and safety boundaries |
| [Release readiness](docs/RELEASE_READINESS.md) · [Decisions](docs/DECISIONS.md) · [Status](docs/STATUS.md) | Limitations, decisions and dated verification records |
| [Security](docs/reports/SECURITY_M5A.md) · [Accessibility](docs/reports/ACCESSIBILITY_M5B.md) · [Performance](docs/reports/PERFORMANCE_M5C.md) | Historical milestone reports |
| [Submission audit](docs/reports/SUBMISSION_AUDIT.md) | Tracked-file/history review, findings and publication limits |
| [Original specification](docs/archive/WARRIDLI_SPEC.md) · [Claude Code instructions](docs/archive/CLAUDE.md) | Historical planning provenance, not current instructions |

## AI-assisted development

**Claude Code and OpenAI Codex** assisted with development, review, documentation and testing. The project
owner directed the work and performed the manual acceptance described above. Original planning documents
and Git history are retained; AI assistance and automated test results do not replace human review.

Before any public submission, review the [submission audit](docs/reports/SUBMISSION_AUDIT.md). Local tests do
not certify hosting, HTTPS/SMTP/scheduler operation, a fresh instructor installation, a complete recovery
rehearsal or production capacity. No push or deployment is part of this documentation handoff.
