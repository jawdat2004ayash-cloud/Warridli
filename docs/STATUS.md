# Status

_Last updated: 2026-10-29 (GitHub submission documentation; application verification retained)_

## GitHub submission documentation (2026-10-29)

- Polished the README with the purpose, implemented features, verified stack/results, a short lab quick start
  and an explicit acknowledgement of **Claude Code and OpenAI Codex**. Preserved detailed setup in
  [HANDOFF](HANDOFF.md#instructor-local-setup); no screenshots or hosted demo were invented.
- Checked tracked tooling and references before moving the original planning documents into
  [`archive/`](archive/CLAUDE.md). Historical notices distinguish them from current instructions; their
  original text is retained. M5a/M5b/M5c reports now live under `reports/`, with incoming links updated.
- [Submission audit](reports/SUBMISSION_AUDIT.md) inspected current tracked source and reachable Git history.
  No credential/backup exposure was identified by the scoped review. Git author/committer metadata includes
  a non-placeholder email address: owner privacy review remains required before public publication.
- Documentation-only changes: no application code, dependencies, database, environment or credentials were
  changed. Application tests were **not rerun**; the actual 2026-10-29 results below remain the latest evidence.
  No push, public repository, deployment or history rewrite was performed.
- Validation passed: **78 local Markdown links/fragments across 19 Markdown files**, fence balance,
  preserved original archive/report text and detailed setup, and `git diff --check`. The 20 external links
  were not fetched. An initial PowerShell encoding issue in the new README/setup heading was corrected
  before the final validation; no application files changed.

## Final local acceptance and diploma handoff (2026-10-29)

- **Owner-confirmed manual PASS:** a buyer registered and created a categorized RFQ for bearing
  **6205-2RS**; an approved matching supplier received it and submitted a quote; the buyer received
  and selected that quote; the supplier received the quote-selection notification.
- Supplier approval and specialization approval were manually tested earlier, as confirmed by the owner.
  This records the core journey only: it does not claim every demonstration step, negative permission
  check, photo upload, recovery, expiry, stale-quote conflict or accessibility flow was manually retested.
- **Owner-confirmed development migration status: Ran** for both
  `2026_10_31_000002_add_expiry_lookup_index_to_rfqs_table` and
  `2026_10_31_000003_preserve_quote_timestamp_microseconds`.
  No development migration, reset, seed or database write was performed during this final polish.
- Removed only the homepage's public "Under development" label and "View design system" link;
  the established layout, styling and role-specific actions are preserved.
- Final automated results are recorded below. The instructor source ZIP is exported from the final commit
  with `git archive` under ignored `artifacts/`; the delivery report gives its exact path and SHA256.

### Final handoff verification

| Check | Outcome |
|---|---|
| Isolated test database preflight | Passed: resolved configuration and live MariaDB 11.4 at **127.0.0.1:3307**, database **warridli_test** |
| `composer check` | Pint passed; Larastan **0 errors**; Pest **293/293 passed, 1541 assertions** |
| `npm run check` | TypeScript, oxlint and production build passed; Vitest **127/127 passed (14 files)** |
| `npm run e2e` | Playwright **52/52 passed, 0 skipped (4.1 minutes)**, desktop and mobile Chrome; live isolated-target preflight passed before preparation |
| Handoff document/source checks | `git diff --check` passed; balanced Markdown fences and **31 local file links** verified in the four edited documents; both homepage labels absent |

The first frontend check reached Vitest but Vite's child-process launch was blocked by the execution sandbox
(`spawn EPERM`). The authorized rerun outside that sandbox passed. Backend and browser database-writing suites
run sequentially against the verified isolated test database; neither targets development `warridli`.

Remaining limits: no public deployment or hosting/TLS/SMTP/scheduler validation, fresh instructor install,
successful SQL/private-photo restore rehearsal or production load guarantee is asserted here. The existing
admin audit quote-price visibility decision remains unresolved before public sharing. Historical milestone
entries below describe their original verification dates; this section supersedes their pending acceptance
and development-migration statements.

## M5d — backup/restore documentation, deployment readiness and diploma handoff (2026-10-28)

- Clean baseline **`d5be2de`**. Added the project [README](../README.md), replaced scaffold READMEs with project
  pointers, and prepared [backup/restore](BACKUP_RESTORE.md), [deployment](DEPLOYMENT.md),
  [instructor handoff/checklist](HANDOFF.md) and [release gates/free-demo assessment](RELEASE_READINESS.md).
- Distinguishes owner development, disposable tests, a future empty restore lab, instructor/demo and production.
  Documents SQL + private-file backups, password prompts, integrity/isolated recovery verification, migration
  approval, same-origin routing, HTTPS, uploads, scheduler, asynchronous reset mail, logs and rollback limits.
- Actual requirements checked from lockfiles/source: Laravel **13.38.0**, PHP **>=8.4.1** for locked production
  dependencies (tested 8.5.12), tested Node **24.21.0** / npm 11.19.0, Vite 8.3.5, MariaDB 11.4 LTS. Standard
  PHP extensions, pdo_mysql and GD JPEG/PNG/WebP available; EXIF available. MariaDB 11.4 maintenance checked
  against the official table (through 29 May 2029); no dependency/server upgrade performed.
- Added a **blank** `.env.testing.example` and source export/ignore rules for sensitive/backup/generated files;
  existing `.env` files/credentials/configuration, migrations, application code and tests are unchanged.
- Official provider documentation checked: alwaysdata has a potentially suitable free subdomain/PHP/MariaDB
  offering, but free cron/short mail-worker operation, limits, account availability, routing and SMTP are
  **unverified**. Render/InfinityFree/static-only limitations and conditional VM option documented. No free
  full-stack compatibility promise, external account, paid service or deployment.
- **Both M5c development migrations remain unapplied.** Explicit migration approval and a newly verified
  backup/restore rehearsal are still required. No backup/import/restore, restore-lab creation, development
  database write, public connection, development-machine exposure or final human acceptance occurred.

### M5d verification actually run

| Check | Outcome |
|---|---|
| `composer check-platform-reqs --no-dev` | Passed on PHP 8.5.12; required photo/DB extensions checked separately |
| Pinned resolved-config + live `TestDatabaseSafety::verifyServer()` preflight | Passed before writing tests: **warridli_test, 127.0.0.1:3307, MariaDB 11.4**; details/secrets suppressed |
| `composer check` | Pint passed, Larastan **0 errors**, **Pest 293/293, 1541 assertions** |
| `npm run check` | TypeScript/oxlint/build passed, **Vitest 127/127** (14 files) |
| Documentation commands | **12** rendered PowerShell blocks parsed without execution; **2** embedded PHP snippets passed `php -l` without execution |
| New test template | Dotenv parse passed; fixed safe test target and blank key/credentials asserted without booting the app |
| Local documentation references | **50** links/anchors and fence balance in **10** files passed |
| Source hygiene | Ignore/export rules checked; app/runtime config/migrations/lockfiles/tests unchanged; `git diff --check` passed |
| Playwright | **Not rerun in M5d**: no browser/application behavior changed; latest actual M5c result **52/52**. Backend and frontend suites passed again |
| Backup/restore, cold install, hosted web config/TLS/SMTP/cron, load test, human acceptance | **Not executed**. Native MariaDB clients not found on PATH; no installation attempted. These remain explicit future gates, not passing checks |

The first documentation syntax validator rejected list-indented Markdown fences because it parsed the raw
indentation as PowerShell. It was corrected to remove the Markdown fence indentation; all 12 rendered blocks
then passed. No command examples were executed to make the parser pass. No final failed checks.
The final source ZIP is produced from the committed source and its contents/hash checked before delivery;
it is ignored under `artifacts/` and contains no Git history. See HANDOFF for reproducible packaging.

## M5c — performance and reliability (2026-10-28)

- Clean baseline `8b84243`; M5c only. Measured synthetic API query budgets, MariaDB expiry plans,
  1,201-recipient notification fanout and the production frontend build. No N+1 found in sampled lists.
- Proposed expiry index reduces actual rows read **10,010 → 10**; made each expiry transition/audit atomic;
  preserved quote-version microseconds to reject unseen edits within a second, including equal/backward clocks.
- Two new migrations authored and tested **only on verified `warridli_test`, port 3307**. Neither was applied
  to development `warridli`; separate approval is required before applying them there. Existing migrations,
  credentials, dependencies, D39 and product/security boundaries are unchanged.
- Backend `composer check`: Pint passed, Larastan 0 errors, **293/293 Pest (1541 assertions)**. Frontend check
  `npm run check` passed **127/127 Vitest**, typecheck/lint/build; separate production-e2e typecheck passed.
  Final `npm run e2e`: **52/52 passed (4.0 minutes), 0 skipped**. Added 9 backend cases and 6 production-browser
  cases across desktop/mobile. Intermediate failures and their fixes are recorded in the report.
- Lazy page code with a persistent layout preserves M5b keyboard focus and provides a private Arabic retry
  on chunk failure. Initial JS: **520,345 → 384,843 bytes**; same-method gzip: **150,801 → 121,953 bytes**
  (19.1% less initial compressed JS). All-route bytes rise with splitting; no production latency/capacity claim.
- Evidence, intermediate failures, migration handoff and load-test limits: [`PERFORMANCE_M5C.md`](reports/PERFORMANCE_M5C.md).
- No M5d, backup/restore, deployment or final human acceptance work started. Admin audit price decision remains open.

## M5b — accessibility, responsive usability and essential UX (2026-10-28)

- Baseline clean `0fbef5a`. Preserved the Arabic RTL design system, architecture, domain behavior and M5a.
- Fixed long-name mobile header overflow; long unit-price wrapping; buyer/supplier confirmation focus,
  Escape/cancel return; contact disclosure focus; generic Arabic page titles and SPA main focus; forced-colour
  focus/select affordances; linked/announced image errors without duplicate server alerts; password-reset
  summary/error clearing. Corrected corrupt Arabic triage conflict messages without changing transitions.
- New Chrome audit matrix: **24 role/page combinations × 3 widths × 2 profiles = 144 layout checks**, at
  320/360/390/768/1280 px, plus keyboard, semantic names/relationships, intended contrast pairs and states.
  Existing real-API browser journeys remain. All DB-writing runs verify the isolated test target first.
- Final results: `composer check` passed **284/284 Pest (1451 assertions)**, Pint and Larastan 0 errors;
  frontend `npm run check` passed **127/127 Vitest**, TypeScript,
  oxlint and build. `npm run e2e` passed **46/46** (desktop + mobile Chrome, 3.4 minutes), **0 skipped**.
  Intermediate red/failing checks and fixes are recorded in
  [`ACCESSIBILITY_M5B.md`](reports/ACCESSIBILITY_M5B.md), along with remaining screen-reader/browser limitations.
- No full WCAG conformance claim or final human acceptance. Admin audit price visibility remains undecided
  and unchanged. No dev DB mutation, credential/dependency change, deployment or M5c work.

## M5a — security audit and targeted hardening (2026-10-28)

- Started from clean `477e4f2`; M5a only. Earlier milestone dates below are preserved as originally recorded.
- Reviewed auth/Sanctum sessions/CSRF/CORS, role and object authorization, RFQs/quotes/approvals/specialties,
  notifications/admin resources, validation/rate limits, uploads, XSS/error handling and secure defaults.
- **Fixed**: multibyte passwords exceeding bcrypt's 72-byte input limit and unhashable NUL input now fail
  validation in registration/reset/admin CLI; login/register clear old identity caches and cancel queries;
  private photos use `private, no-store` across buyer/supplier/admin routes.
- **Test safety**: shared URL-aware guard enforces the isolated test driver/host/port/schema and rejects
  read/write overrides; PHPUnit/e2e pin the target. Browser setup verifies the live MariaDB test server before
  preparation. Credentials and environment files unchanged; no write command targeted development `warridli`.
- **Decision needed, behavior preserved**: existing admin audit metadata includes quote prices, conflicting
  with buyer-only quote wording. No API role bypass found in reviewed paths. Existing account passwords were
  not changed; old overlength input cannot be determined from a stored hash.
- Full findings, limits, red regressions and execution issues: [`SECURITY_M5A.md`](reports/SECURITY_M5A.md).
- Final `composer check`: Pint passed, Larastan 0 errors, **Pest 283/283 (1442 assertions)**.
  Final `npm run check`: TypeScript/oxlint/build passed, **Vitest 125/125**. Focused backend 23/23; frontend 15/15.
  **Playwright 18/18 passed** (desktop + mobile, real Chrome); test servers stopped. TypeScript/oxlint and the
  shared live-server guard were rechecked after the browser-preflight refinement. Initial sandbox/preflight
  invocation failures are recorded in the audit; no final failed or skipped checks.
- M5b accessibility/performance/backups/deployment/manual acceptance not started; no dependency upgrades.

## Git history
| Milestone | Commit |
|---|---|
| M0 — plan, docs, `.gitignore` | `8b22f6f` docs: initial Warridli project plan |
| M1a — backend foundation | `56b100e` feat(backend): M1a Laravel scaffold, MariaDB 11.4, test isolation, health check |
| M1b — frontend + design system | `6a29d0c` feat(frontend): M1b React/Vite/TS scaffold, industrial RTL design system, specimen |
| M1b — verification fix | `eb831f2` fix(frontend): keep anchors/focus clear of sticky header; 44px skip link |
| M2a — auth backend | `95c3273` feat(backend): M2a Sanctum SPA auth, registration with company, password reset, admin CLI |
| M2b — auth pages + e2e | `4fb97f0` feat(frontend): M2b Arabic auth pages on Sanctum + Playwright real-browser e2e |
| M2c — vetting + suspension + audit | `7956e47` feat(backend): M2c supplier vetting, account/company suspension, audited admin API |
| M3a — categories + RFQ create/list/details | `71f15e5` feat: M3a part categories, buyer RFQs with private photo uploads, Arabic RFQ pages |
| M3b — targeting + supplier inbox + quotes | `c4462c4` feat: M3b category targeting, supplier inbox and quotes (submit/edit/withdraw) |
| M3c — compare / choose / contact / close / expiry | `78b45a0` feat: M3c quote comparison, safe quote choice, WhatsApp contact, close and expiry |
| M4a — admin panel | `b18d904` feat: M4a admin panel — vetting, triage, categories, metrics, audit trail |
| M4b — notifications + usability | `477e4f2` feat: M4b in-app notifications, session-aware home and header |
| M5a — security audit + targeted hardening | `0fbef5a` fix: M5a security audit and targeted hardening |
| M5b — accessibility + responsive usability | `8b84243` fix: M5b accessibility and responsive usability |
| M5c — performance + reliability | `d5be2de` perf: M5c performance and reliability |

## M4b — in-app notifications + usability fixes (2026-10-31)
- **Backend**: migration `notifications` (Laravel shape + `dedupe_key`, unique per recipient; microsecond timestamps for stable order) — additive, `--pretend` = 1 CREATE + 3 indexes; applied to dev `warridli`, rows unchanged (users=3, companies=2, rfqs=1, categories=3, admins=1 — accounts the founder created after M4a). `Enums/NotificationKind` (9 kinds), `Services/Notifier` (bulk INSERT IGNORE, active members only, one query for the matching-supplier audience), wired into `TransitionCompanyStatus` (approve/reject), `ReviewSupplierCategory`, `CreateRfq`, `TriageRfq` (assign/reject), `SubmitQuote` (first submission), `SelectQuote`; `NotificationController` (index with `meta.unread`, unread-count, read one, read all) + `NotificationResource`. See D39 and API.md for the event table.
- **Frontend**: header bell (all company members, also on phones) with unread badge + screen-reader text, polling 60 s; `/notifications` page (Arabic wording per kind, unread dot + «جديد», opening an item marks it read then navigates to the request/page, «علّم الكل كمقروء», pagination, loading/empty/error/retry); `Pager` moved to `components/ui`; `bell` icon. **Usability fixes (F12)**: home page is session-aware (no sign-up/login CTAs for logged-in users; buyer «اطلب سعر قطعة الآن» → `/rfqs/new`; supplier / admin next steps), so on phones — where the header hides «طلباتي» — the buyer still has a one-tap path.
- **Not in scope / later**: email/SMS/WhatsApp delivery (none, by instruction), push notifications, notification preferences, back-filling events from before M4b, notifying on suspension/expiry.

### Commands actually run (M4b)
| Command | Result |
|---|---|
| Baseline (git clean at `b18d904`) | `composer check` Pest 250/250 ✓ · `npm run check` ✓ |
| `composer check` (final) | Pint ✓ · Larastan 0 ✓ · **Pest 263/263 (1371 assertions)** on `warridli_test` |
| Mutation: removed the "first submission only" guard in `SubmitQuote` | tests still passed — the DB dedupe key alone already prevents the duplicate (two independent layers). Removing **both** guard and key → the quote test fails; restored (verified) |
| `npm run check` (final) | tsc ✓ · oxlint ✓ · **Vitest 123/123** · build ✓ |
| `npm run e2e` (final, real Chrome, desktop 1280 + mobile 360) | **18/18 passed** (incl. 2 new notification journeys); ports 8020/5174 free |
| `migrate --pretend` → `migrate` on `warridli` | additive only; counts identical before/after |

Backend tests (13 new, `tests/Feature/NotificationTest.php`): own rows only, newest first, allow-listed shape (no recipient columns / dedupe key / other users' data), unread count, pagination with a bounded query count (≤ 8 for a page), mark one (idempotent; another user's id, random UUID, non-UUID → 404 and unchanged), mark all only own, guests 401, suspended 403; events: supplier approve/reject to every active member (suspended member skipped, suspension sends nothing), specialty decisions with category name, new RFQ reaches exactly the suppliers approved in that category (not pending specialty, pending company, other category, buyer's colleagues) without buyer name/phone, unknown category notifies nobody until triage then suppliers + buyer (refused second triage adds nothing), rejection to buyer only without the reason, first quote only to buyer company (edits/withdraw/re-submit don't repeat; no price), selection only to the chosen supplier (repeat/refused choice adds nothing), DB-level dedupe. Route inventory updated.

What the notifications e2e proves (each project): supplier approved with its specialty via the CLI → buyer's home shows «اطلب سعر قطعة الآن» and no sign-up link, and it opens `/rfqs/new` → buyer posts a bearings request → the supplier's bell reads «الإشعارات — 3 غير مقروءة» (approval, specialty, request) → opening the request notification lands on the request and the bell drops to 2 → the supplier quotes → the buyer's bell shows 1, the notification opens the comparison with the quote → «علّم الكل كمقروء» clears the badge → the buyer gets 404 marking the supplier's notification. No horizontal scroll at 360 px; screenshots reviewed.

### Issues found and fixed during M4b
1. A single notification response wasn't wrapped in `data` (Laravel skips wrapping when the payload has its own `data` key) → wrapped explicitly + test.
2. Several events in the same second came back in random order (UUID keys) → microsecond timestamps; PDO drops microseconds from Carbon bindings, so the Notifier passes a formatted string.

## M4a — admin panel (2026-10-30)
- **Backend**: migration `rfqs.triaged_by/triaged_at` (additive; `--pretend` = 3 ALTER ADD statements; applied to dev `warridli`, rows unchanged: users=1, companies=1, rfqs=1, categories=3, admins=0). Actions `Admin/TriageRfq` (assign category → open with a fresh 7-day window, or reject with reason; row lock, 409 otherwise, category re-checked under lock), `Admin/SaveCategory` (create with generated slug / update / (de)activate; audited; no-op not audited); `Services/OperationalMetrics` (D37); controllers `Admin/{Rfq,Category,Metrics,AuditLog}Controller`, `RfqPhotoController::forAdmin`; requests `TriageRfq, RejectRfq, ListAdminRfqs, SaveCategory, ListAuditLogs, Metrics`; resources `AdminRfq, AdminCategory, AuditLog` (secret-looking meta keys dropped); companies list gains `pending_categories` and `q`; `AuditLog::subject()` morph + `category` in the morph map. **Bug fixed** (found while designing D36): saving the supplier specialty form silently removed an approved specialty whose category had been deactivated.
- **Frontend** (`/admin`, admins only — `RequireAdmin` is UX; the API enforces): section bar with waiting counts; **نظرة عامة** (waiting-work tiles + figures list with one-line definitions, period 7/30/90/all, no charts); **المورّدون والشركات** (views: pending suppliers / pending specialties / approved / suspended / rejected; search by name or email; approve/reject/suspend/reactivate company; approve/reject specialty; suspend/reactivate user; link to the company's audit trail); **طلبات بلا تصنيف** (oldest first, waiting time) → detail with photos, buyer + phone, category cards with approved-supplier counts, warning for a category with no supplier, folded reject with required reason; **التصنيفات** (add, rename/reorder, deactivate/activate with the effect explained, no delete); **سجل العمليات** (Arabic action labels, actor or «النظام», subject links, labelled meta, IP; filters type/actor/dates/subject). Every sensitive action uses `ConfirmAction` (inline, focus moves in, Escape returns, reason required where needed, server 409/422 shown) + a success toast. Header «الإدارة» (desktop) and a link on `/account` (phones). `Button` accepts `ref`; `formatDateTime`.
- **Not in scope / later (M4b+)**: notifications about triage/approval, showing rejection reasons to buyer/supplier, editing areas, auditing admin reads (D38).

### Commands actually run (M4a)
| Command | Result |
|---|---|
| Baseline (git clean at `78b45a0`) | `composer check` Pint ✓ · Larastan 0 · Pest 216/216 · `npm run check` Vitest 97/97 + build ✓ |
| `composer check` (final) | Pint ✓ · Larastan 0 ✓ · **Pest 250/250 (1285 assertions)** on `warridli_test` |
| Mutation: disabled the "still pending" guard in `TriageRfq` | 6 triage tests fail → restored (verified) |
| `npm run check` (final) | tsc ✓ · oxlint ✓ · **Vitest 113/113** · build ✓ |
| `npm run e2e` (final, real Chrome, desktop 1280 + mobile 360) | **16/16 passed** (incl. 2 new admin journeys); ports 8020/5174 free |
| `migrate --pretend` → `migrate` on `warridli` | additive only; counts identical before/after; no admin account created |

Backend tests (34 new): triage queue order/shape (buyer included, no prices), filters, admin photo route headers + scoping + unknown ULID 404; triage opens with a fresh window, is audited, reaches only suppliers approved in that category, smuggled fields ignored; category required/active/existing (Arabic); 409 with nothing changed for open/cancelled/rejected/closed/expired; second admin 409; reject needs a reason, audit meta, invisible to suppliers, buyer sees rejected and cannot cancel; **buyer, approved supplier, pending supplier, suspended admin → 403 on all 11 M4a URLs incl. unknown ids, nothing changed**; guests 401. Categories: counts, ordering, create (generated slug, client slug/id ignored, appended order, audit, offered to buyers), Arabic validation (duplicate after trimming, length, is_active on create), rename audit with old name, no-op not audited, deactivate keeps RFQs + specialties + supplier inbox, specialty form no longer drops it, refused for new RFQs/specialties/triage, reactivate, no DELETE (405), unknown 404. Metrics: every definition on a fixed dataset, 7/30/all periods, 422 otherwise, nulls when empty. Audit: shape, labels, RFQ ref, secret-key filtering, group/actor/subject/Damascus-day filters, invalid filters 422, read-only. Companies: pending-specialty view, search incl. wildcard escaping.

What the admin e2e proves (real browser, both projects): a buyer sends an «unknown» request; a pending supplier asks for bearings; **the supplier's own session gets 403** on metrics and on triage; a throw-away admin (test DB) sees the overview, finds the supplier by email, approves it and its specialty with confirmations and success messages; opens the request, is stopped until a category is chosen, sees the 7-day explanation, classifies it → **the supplier's inbox API now contains it**; adds a category (visible in the public list) and deactivates it (gone from the public list); the audit trail filtered to requests shows the triage by «مدير الاختبار»; a supplier opening `/admin` sees the admins-only page. No horizontal scroll at 360 px; overview/companies/triage/audit screenshots (desktop + mobile) reviewed.

### Issues found and fixed during M4a
1. Specialty form dropped approved specialties of deactivated categories (D36) → fixed + test.
2. Figures would have rendered Arabic words in the mono font (F3) → only numbers wrapped in `.num`.
3. Audit trail showed `closes_at` as a raw ISO string and meta labels wrapped mid-label on phones (screenshots) → formatted date, `nowrap` labels.
4. On phones the header hides secondary links, so «الإدارة» was unreachable → link on `/account` + test.
5. a11y lint: the inline confirmation used `role=group` + a key handler on a div → `<fieldset>` with a native listener.

## M3c — quote comparison, choice, contact, close, expiry (2026-10-29)
- **Backend**: migrations `rfqs.selected_quote_id` (FK quotes, nullOnDelete) and `contact_events` — additive, `--pretend` 0 destructive statements, dev rows unchanged (users=1, companies=1, rfqs=1 still `pending_review`). `Quote::visibleToBuyer` (submitted + supplier approved) / `isPriceExpired`; `RfqStatus::isClosable`; actions `Rfqs/SelectQuote` (RFQ→quote row locks, idempotent repeat, stale-version / withdrawn / expired-price / state checks → 409, audit), `Rfqs/CloseRfq`, `Rfqs/RevealSupplierContact` (rules D33, `contact_events`), `Rfqs/ExpireRfqs` + `warridli:expire-rfqs` scheduled every 15 min (conditional UPDATE, audited, idempotent); `RfqQuoteController` (index/select/contact, scoped `{quote}`), `RfqController::close`; `BuyerQuoteResource` (no phone); buyer `Rfq` + `accepts_quotes`, `selected_quote_id`; supplier `my_quote.selected`; limiter `contact`.
- **Frontend**: RFQ detail now has a «عروض الأسعار» section: count, sort (cheapest / fastest / newest), per-currency notice, quote cards (supplier + area + «مورّد موثّق», big unit price + total for the requested quantity, condition, availability with Arabic day agreement, pickup/delivery, validity, brand/origin, notes; badges «الأرخص» / «العرض الذي اخترته» / «انتهت صلاحية السعر»), «أظهر رقم واتساب المورّد» → number + «افتح المحادثة في واتساب» link, «اختر هذا العرض» with an explicit confirmation stating the total and that it is final, 409 explanations shown and quotes reloaded; status notices for expired/closed; footer «أغلق الطلب دون اختيار عرض» (or «إلغاء الطلب» while nothing arrived). Two quotes side by side when the sheet is wide (container query), one column on phones. Supplier pages show «اختار المشتري عرضك». API client shows our Arabic 403/409 messages (F11).
- **Not in scope / later**: notifications to suppliers/buyers (M4b), admin triage + metrics on `contact_events` (M4a), rating suppliers, reopening a closed RFQ.

### Commands actually run (M3c)
| Command | Result |
|---|---|
| Baseline (git clean at `c4462c4`) | `composer check` Pest 198/198 ✓ · `npm run check` Vitest 88/88 + build ✓ |
| `php artisan migrate --pretend` → `migrate` on `warridli` | 0 destructive statements; dev rows unchanged. `warridli:expire-rfqs` was **not** run on `warridli` |
| `composer check` (final) | Pint ✓ · Larastan 0 ✓ · **Pest 216/216 (967 assertions)** on `warridli_test` |
| Mutation checks: removed the "seen version" guard; removed both same-RFQ checks (action filter + scoped binding) | each makes a test fail → restored |
| `npm run check` (final) | tsc ✓ · oxlint ✓ · **Vitest 97/97** · build ✓ |
| `npm run e2e` (final, real Chrome, desktop 1280 + mobile 360) | **14/14 passed** (6 auth + 4 RFQ + 2 supplier + 2 compare); ports 8020/5174 free |

What the compare e2e proves: two approved suppliers quote → buyer sees «وصلك 2 عروض», cheapest first with «الأرخص», total 360,000 for 4, «خلال 3 أيام», no phone on the page → reveals one number → WhatsApp link `https://wa.me/963…?text=` → supplier B edits its price while the page is open → choosing B is refused with the Arabic explanation and the new total 520,000 appears → buyer chooses A with confirmation → «اخترت عرضاً وأغلقت الطلب.», no more choose buttons → supplier A sees «اختار المشتري عرضك.», supplier B's API has `selected:false` and not A's price → another buyer gets 404 on the quotes. No horizontal scroll at 360 px; desktop and mobile screenshots reviewed.

Backend tests cover: visible quotes only (withdrawn and suspended-supplier hidden), sort, allow-listed keys, no phones/ids; other buyer / quoting supplier / admin → 404 on list, select, contact, close, with nothing changed; guests 401; quote of another RFQ via this URL → 404; select closes + audit + supplier `selected` true/false + no further supplier edits; repeat select idempotent, different quote afterwards 409; withdrawn / suspended / expired-price → 409; supplier edit after view → 409 then the fresh version succeeds; missing version → 422; choose from `expired`; not on cancelled; close once, then close/cancel 409; contact returns phone + prefilled wa.me + `contact_events` row; contact rules (withdrawn, hidden, other quote after close → 409); contact rate limit; expiry command (only open past deadline, idempotent, audited without actor, pending/closed/future untouched, still choosable); expiry is scheduled.

### Issues found and fixed during M3c
1. **Arabic 409 explanations never reached users** (API client replaced them with a generic error since M3a) → F11 + tests.
2. Strict mode: a just-created RFQ lacked `selected_quote_id` → model default.
3. Desktop comparison stayed one column (page wrapper not widened) and the WhatsApp icon sat above the button text → fixed after screenshot review (`detailPage`, Button `icon` prop).
4. e2e suppliers all had the same company name → names include the test label.

## M3b — targeting, supplier inbox, quotes (2026-10-28)
- **Backend**: migrations `supplier_categories`, `quotes` (unique(rfq, supplier company), CHECK unit_price > 0) — additive, applied to dev `warridli` after `--pretend` (0 destructive statements); existing dev rows untouched (users=1, companies=1, rfqs=1 before and after). Enums `SupplierCategoryStatus, Currency, QuoteCondition, StockStatus, Fulfillment, QuoteStatus`; models `SupplierCategory`, `Quote`; `Rfq::quotableBy / visibleToSupplier / acceptsQuotes` (D30); `RfqPolicy::viewAsSupplier / quote` (else 404); middleware `supplier` (before binding); actions `Quotes/SubmitQuote` (upsert, row lock, audit with changed fields), `Quotes/WithdrawQuote`, `Suppliers/UpdateSupplierCategories`, `Suppliers/ReviewSupplierCategory`; controllers `Supplier/{SupplierRfq,Quote,SupplierCategory}Controller`, `Admin/SupplierCategoryController`, photo controller split buyer/supplier; resources `SupplierRfqResource` (no buyer identity, own quote only), `QuoteResource`, `SupplierCategoryResource`; `UpsertQuoteRequest` (authorize before validate); limiter `quote-submit`; buyer `quotes_count`; `warridli:approve-supplier` CLI (D32); `TransitionCompanyStatus` accepts a null actor (CLI).
- **Frontend**: `/supplier/rfqs` (tabs «طلبات جديدة» / «عروضي», my-quote badge, pagination, empty/error/loading), `/supplier/rfqs/:id` (part, photos, quantity, buyer area only + privacy note; quote form: price + currency with live total, condition cards, availability cards + days, pickup/delivery, validity date, folded brand/origin/notes; sent summary; edit; withdraw with confirmation; re-submit; closed state; 404 state), `/supplier/categories` (checkbox cards with «معتمد» / «قيد المراجعة»), guard `RequireSupplier` (UX only; under-review notice), header link («الطلبات» / «تخصصاتي»), account links, buyer detail shows the number of quotes received. Price input accepts Arabic digits and thousands separators.
- **Not in scope / later**: buyer quote comparison + WhatsApp contact + close/select + expiry job (M3c); admin panel UI for vetting/specialties (M4a); notifications (M4b).

### Commands actually run (M3b)
| Command | Result |
|---|---|
| Baseline (git clean at `71f15e5`) | `composer check` Pest 149/149 ✓ |
| `php artisan migrate --pretend` → `migrate` on `warridli` | 0 destructive statements; 2 tables created; dev counts unchanged |
| `composer check` (final) | Pint ✓ · Larastan 0 ✓ · **Pest 198/198 (849 assertions)** on `warridli_test` |
| Mutation check: dropped the "approved" filter from targeting | 3 supplier tests fail → restored |
| `npm run check` (final) | tsc ✓ · oxlint ✓ · **Vitest 88/88** · build ✓ |
| `npm run e2e` (final, real Chrome, desktop 1280 + mobile 360) | **12/12 passed** (6 auth + 4 RFQ + 2 supplier); ports 8020/5174 free |

What the supplier e2e proves: buyer posts a bearings RFQ → new supplier sees «قيد المراجعة», picks «بيليا» in the specialties page → approved via the CLI → RFQ appears in the inbox → detail page contains no buyer company name or phone → quote typed as «125,000» shows total 500,000 for 4 pieces → sent → edited → withdrawn after confirmation → re-submitted (form pre-filled) → API returns `119000.00 submitted` → an approved supplier with no specialty gets 404 on API, quote PUT and page. No horizontal scroll at 360 px; mobile screenshots reviewed.

Backend tests cover: targeting excludes other categories, pending-review, expired, cancelled; unknown/foreign ULIDs → 404 on detail, photo and quote; buyer URL closed to suppliers; specialty approval makes RFQs appear; pending/rejected supplier, buyer, admin → Arabic 403 even for unknown ids; suspended supplier logged out; guests 401; no buyer identity in list/detail JSON; competitor's quote never visible; submit/edit (no duplicate, DB unique enforced)/colleague edit/withdraw/second withdraw 409/re-submit with audit trail; buyer count excludes withdrawn; 13 validation cases (zero/negative/text/3-decimal/huge price, enums, lead time, past/far validity) with Arabic messages; smuggled ownership fields ignored; cancelled RFQ → 409 but still under «quoted»; removed category approval → 409; 404-not-422 for foreign RFQ with bad body; rate limit 429; specialties request/remove/keep-approved, inactive rejected, buyers 403; admin approve/reject/409, non-admin 403; CLI approve with confirmation, `--force`, refuses buyers/unknown emails.

### Issues found and fixed during M3b
1. Quote validation ran before the RFQ visibility check (a foreign RFQ with a bad body would answer 422 and reveal it exists) → authorization moved into `UpsertQuoteRequest::authorize()`; regression test.
2. `can:approved-supplier` runs after model binding (ULID probing) → dedicated `supplier` middleware placed before binding (D24 pattern).
3. Mobile screenshot: currency select truncated («ليرة سورية (ل.») → shorter labels; «خلال 3 يوم» → Arabic number agreement helper (`daysLabel`) + test.
4. jsx-a11y `label-has-associated-control` (depth 2) on radio cards → flatter markup instead of loosening the rule.

## M3a — categories + buyer RFQs (2026-10-27)
- **Backend**: migrations `categories`, `rfqs` (CHECK quantity > 0), `rfq_attachments` (additive; applied to dev `warridli` after `--pretend` showed no drop/truncate/delete); `CategorySeeder` (3 hypotheses, D25) run on `warridli`. Enums `RfqStatus/RfqUrgency/RfqUnit`; models `Category`, `Rfq` (ULID route key), `RfqAttachment`; `RfqPolicy` (approved buyer company; others' RFQs → 404); `StoreRfqRequest` (authorize before validate; `category` = id or `unknown`); actions `CreateRfq` (sanitize photos → transaction → files cleaned up on failure → audit) and `CancelRfq` (row lock, 409, audit); `ImageSanitizer` (D28); controllers `CategoryController`, `Rfqs/RfqController`, `Rfqs/RfqPhotoController`; `RfqResource`; rate limiter `rfq-create`; Arabic 413 + Arabic 404 for policy `denyAsNotFound`; local disk `serve: false`, root overridable (`PRIVATE_STORAGE_ROOT`, used by e2e only).
- **Frontend**: `/rfqs` (my requests: status/urgency/category/photos count, pagination, empty/error/loading), `/rfqs/new` (4 numbered sections: part + photos + part number · quantity/unit + urgency cards · category cards incl. «لا أعرف التصنيف» · area pre-filled + folded machine info; privacy note; error summary; server 422 mapped to fields), `/rfqs/:id` (status explanation, photos, part tag, facts, empty quotes section, cancel with explicit confirmation, 404 state). `PhotoPicker` (camera on phones, ≤5, browser resize to 1600 px, previews, remove, Arabic errors), `RequireBuyer` (UX only), header link «طلباتي» for buyers, entry on `/account`.
- **Not in scope / later**: supplier inbox & quotes (M3b), close/selection/expiry job (M3c), admin triage & category CRUD (M4a), editing an RFQ after submit.

### Commands actually run (M3a)
| Command | Result |
|---|---|
| Baseline (git clean at `7956e47`) | `composer check` Pest 114/114 ✓ |
| `php -m` / `gd_info()` | gd (JPEG/PNG/WebP), exif, fileinfo available; Herd `upload_max_filesize=2M`, `post_max_size=8M`, `memory_limit=128M` (not changed) |
| `php artisan migrate --pretend` → `migrate` on `warridli` | 0 drop/truncate/delete; 3 tables created; `CategorySeeder` → categories=3, rfqs=0 |
| `composer check` (final) | Pint ✓ · Larastan 0 ✓ · **Pest 149/149 (599 assertions)** on `warridli_test` |
| `npm run check` (final) | tsc ✓ · oxlint ✓ · **Vitest 75/75** · build ✓ |
| `npm run e2e` (final, real Chrome, desktop 1280 + mobile 360) | **10/10 passed** (6 auth + 4 RFQ); ports 8020/5174 free afterwards |

What the RFQ e2e proves: register a buyer through the real API → empty list → create an RFQ with a real 2400×1800 photo → photo stored and served privately at **1600 px** (resized in the browser), `image/jpeg` + `nosniff` → «لا أعرف التصنيف» lands in review → both in the list → a second buyer gets **404** for the RFQ API, its photo and its page → empty submit focuses the error summary and its link focuses the field → no horizontal scroll at 360 px. Screenshots (form, details, list; desktop + mobile) reviewed.

Backend tests cover: create open/pending_review with audit; Arabic validation; unknown/inactive/malformed/injection-like categories; smuggled `buyer_company_id/status/created_by` ignored; supplier/admin/suspended-company cannot create (403 before validation); guests 401; photos re-encoded, downscaled 3000→2000, generated names, no client filename or path in the response; PHP payload appended to a PNG not present after re-encode; php-as-jpg, SVG, PDF, GIF rejected with nothing stored; 10000×10000 header bomb rejected before decoding; >5 photos and >5 MB rejected; rate limit 429; own-company list only, newest first, paginated; colleague in same company can view; another company → 404 for details/photo/cancel; unknown and numeric ids → 404; photo of RFQ A via RFQ B's URL → 404; suppliers/admins out; cancel once, then 409; categories list active only; seeder idempotent without overwriting admin edits.

### Issues found and fixed during M3a
1. Policy `denyAsNotFound()` produced an English «Not Found» (plain `HttpException(404)`, not `NotFoundHttpException`) → handler fixed (D29).
2. Part-number example in an Arabic hint rendered as «2RS-6205» (bidi, seen in the mobile screenshot) → Unicode isolate + Vitest regression test.
3. e2e API calls without the SPA `Origin` got 400/401 from Sanctum (correct behaviour) → helper sends the SPA origin like the browser.
4. Registration rate limit would trip across spec files → RFQ spec clears rate-limit counters on `warridli_test` first.
5. Lint: ref read during render in the photo picker → updater-based `onChange`.

## M2c — supplier vetting, suspension, audit (2026-10-26) — backend only
- Admin API (see `API.md`): list companies (filter status/type, paginated, review queue oldest first); approve / reject / suspend / reactivate a company; suspend / reactivate a user. No migration needed (columns existed since M2a).
- Code: `Enums/CompanyTransition` (state machine, D22), `Actions/Admin/TransitionCompanyStatus` + `SetUserSuspension` (transaction + row lock + audit), `Services/SessionRevoker`, `Http/Middleware/EnsureUserIsAdmin` (alias `admin`, runs before model binding, D24), `Controllers/Admin/{Company,UserSuspension}Controller`, `Requests/Admin/{ListCompanies,AdminReason}Request`, `Resources/Admin/AdminCompanyResource`, `Gate approved-supplier`, `User::accessBlockedMessage()` used by login + `EnsureUserIsActive` (suspended company blocks all its members, D23).
- Error handler: Gate `Response::deny('…')` Arabic messages are now passed through; message-less denials still get the generic Arabic 403.
- Tests (37 new, `tests/Feature/Admin/*` + `AuthorizationTest`): approve/reject with audit content (actor, action, subject, from/to, reason, ip, time); reason required; smuggled `status`/`verified_by` ignored; 8 invalid-transition cases → 409 with no change and no audit row; buyer never reviewed but suspendable; suspended company → member's next request 403 + logged out, login refused, reactivation restores login; only the members' stored sessions deleted; user suspend/reactivate, remember token rotated, conflicts 409, admins (incl. self) cannot be suspended; non-admins (buyer, approved/pending supplier, suspended admin) get 403 on every admin endpoint **including non-existent IDs**; guests 401; admin 404 for unknown IDs/actions; `approved-supplier` gate: approved passes, pending/rejected/suspended/buyer/admin denied with the right Arabic reason, approval opens and suspension closes access; route inventory + "every admin route has `auth:sanctum, active, admin`".
- Mutation check: removing the middleware-priority line makes the "no ID probing" test fail (3/4 cases), file restored.

### Commands actually run (M2c)
| Command | Result |
|---|---|
| Baseline `composer check` (git clean at `4fb97f0`) | Pint ✓ · Larastan 0 ✓ · Pest 77/77 |
| `composer check` (final) | Pint ✓ · Larastan 0 errors ✓ · **Pest 114/114 passed, 453 assertions** (on `warridli_test`) |
| `npm run check` (frontend regression) | tsc ✓ · oxlint ✓ · **Vitest 60/60** · build ✓ |
| `npm run e2e` (M2b regression, real Chrome) | **6/6 passed (25.7 s)**; ports 8020/5174 free afterwards |

### Issues found and fixed during M2c
1. Default middleware priority runs route model binding before `can:admin` → a non-admin could tell existing from non-existing IDs (404 vs 403). Fixed with the `admin` middleware placed before `SubstituteBindings` (D24); covered by tests + mutation check.
2. The 403 handler replaced every Gate denial with the generic message, which would have hidden the "under review" reason → only message-less denials are replaced now.
3. Tests switching users inside one test got 401 from Sanctum's `AuthenticateSession` (previous user's password hash in the shared test session) → `actAs()` / `asGuest()` helpers in `tests/Pest.php` simulate a separate browser.
4. Larastan doesn't read `verified_at` from `casts()` → `@property` on `Company`.

## M2b — auth pages (2026-10-26)
- Pages: `/login`, `/register` (choose: «أحتاج قطعة غيار» / «أبيع قطع غيار»), `/register/buyer`, `/register/supplier`, `/account` (current user + company + status; logout), `/forgot-password`, `/reset-password`. Header shows «تسجيل الدخول / حساب جديد» or the user's name. Home links to register/login.
- Auth client `src/lib/auth.ts` (CSRF cookie refreshed before every auth mutation; 401 on `/api/me` = guest; `safeNextPath` against open redirects), hooks `features/auth/hooks.ts` (TanStack Query `['me']`; logout clears the whole cache), guards (F9), one-time success messages via router state (`flash.ts`).
- New UI: `Notice` (inline persistent outcome, can take focus), `ErrorSummary` (F7), `PasswordInput` (show/hide, `aria-pressed`); icons eye/eyeOff/wrench/store/user; `Field` accepts a fixed `id`.
- UX: short plain Arabic, a hint under each field, Syrian phone accepted with Arabic digits/spaces, password show/hide, error summary linking to fields, focus moved to errors, explicit success messages (registered / logged in / logged out / password changed), supplier "under review" notice, 44px targets, logical CSS (RTL), email/phone `dir=ltr`.
- Backend: `APP_ENV=e2e` guard in `AppServiceProvider` (+ Pest test).

### Commands actually run (M2b, final)
| Command | Result |
|---|---|
| Baseline before changes | `composer check` Pest 76/76 ✓ · `npm run check` Vitest 22/22 + build ✓ |
| `npm install -D -E @playwright/test@1.64.1` (released 2026-10-14; no browser download, uses installed Chrome) | 0 vulnerabilities |
| `npm run check` (tsc + oxlint + Vitest + build) | ✓ · **Vitest 60/60** (7 files) · build ✓ |
| `npm run e2e` (Playwright, desktop 1280 + mobile 360 projects) | **6/6 passed (24.4 s)**; ports 8020/5174 free afterwards |
| `composer check` | Pint ✓ · Larastan 0 ✓ · **Pest 77/77** (251 assertions) |
| Dev DB `warridli` counts before vs after all e2e runs | identical (`users=0 companies=0 sessions=2 audit=0`), 0 `e2e-%` accounts |

What the e2e proves (real Chrome, real Laravel + MariaDB `warridli_test`): register through the UI → `/account` with success message and server-normalized phone; session cookie `HttpOnly`, `SameSite=Lax`, not readable by JS, XSRF cookie readable; session survives reload; cookie-carrying requests without same-origin proof get 419 with no/forged token and pass with the real token; non-stateful origin → 401; logout → server-side invalidation (replaying the old session cookie → 401); `/account` → `/login?next=%2Faccount`; wrong password → Arabic alert that takes focus; keyboard-only login (Tab/Enter) rotates the session id; supplier → "under review"; no horizontal scroll at 360 px on login/register/forgot pages; error summary disappears once fields are fixed.

### Issues found and fixed during M2b
1. **Playwright `webServer` hung forever at teardown on Windows** (cmd.exe + Herd `php.bat`; both servers left running). Stuck run stopped after verifying its processes; servers are now managed by `global-setup.ts` (F10). Runs take ~25 s.
2. Laravel's `server.php` uses the working directory as public root — and its PHP warning page returned **200**, fooling the readiness check. Now run from `backend/public`, and readiness requires the real JSON health answer through the proxy.
3. Label locators: visible label text includes the `*` → anchored regexes.
4. **Success message lost after register/login** in the real browser (race between `GuestOnly`'s redirect and the page's own navigation; jsdom hid it) → F9.
5. Test aborted the logout request by navigating immediately → wait for `/login`.
6. CSRF expectation was wrong for Laravel 13 (Fetch Metadata) → test rewritten to the real threat model (F8). Not a vulnerability.
7. Registration rate limit (5/min/IP, D16) tripped by 6 registrations per run → duplicate-email check left to Pest/Vitest; limiter counters reset per run (test DB only).
8. **Stale errors**: after a failed submit, fixed fields stayed red with old messages (seen in screenshot) → errors clear on edit, summary is live, focus moves only on submit (F7); regression tests in Vitest + e2e.
9. Removed an unapproved «التسجيل مجاني» claim from the register chooser.

## M2a — auth backend (2026-10-26)
- **Sanctum 4.3.3**, SPA cookie auth only (D13). Endpoints: register / login / logout / me / forgot-password / reset-password / areas (see `API.md`).
- Schema (5 new, additive migrations): `users.is_admin`, `users.suspended_at`; `areas`; `companies` (enum type/status, FK area, `verified_by`); `company_members` (unique `user_id` = D9, cascade); `audit_logs`.
- Code: `Actions/Auth/RegisterAccount` (transaction: user + company + owner membership + audit), `Http/Controllers/Auth/*`, FormRequests `Http/Requests/Auth/*`, `MeResource` (allow-list), `EnsureUserIsActive` middleware (`active`), `Gate admin`, rate limiters in `AppServiceProvider`, `Support/SyrianPhone`, `Services/AuditLogger`, `Notifications/ResetPasswordNotification` (queued, Arabic), `Console/Commands/CreateAdminCommand`, `lang/ar/validation.php`, Arabic 401/403/404/419/429 in `bootstrap/app.php`.
- Security properties tested: privilege fields in payload ignored; same login error for unknown email vs wrong password (framework Timebox); suspended user blocked at login and logged out mid-session; reset token stored hashed, single-use, expires after 60 min, one message for every invalid case, all of the user's sessions deleted + remember token rotated; forgot-password identical for unknown/throttled; `/me` never exposes other users or the password hash; admin gate (non-admin/suspended admin 403, guest 401); route inventory test = no user-listing or password endpoints; admin CLI never prints the password and never promotes an existing account.

### Commands actually run (M2a)
| Command | Result |
|---|---|
| `composer check` before changes (baseline) | Pint ✓ · Larastan 0 ✓ · Pest 7/7 ✓ |
| `composer require laravel/sanctum` + publish config | v4.3.3, no security advisories |
| `composer check` (final) | Pint ✓ · Larastan 0 errors ✓ · **Pest 76/76 passed, 248 assertions** (on `warridli_test`) |
| `php artisan migrate --pretend` then `migrate` on dev DB `warridli` | no drop/truncate/delete statements; 5 migrations applied |
| `php artisan db:seed --class=AreaSeeder` on `warridli` | 14 areas (idempotent) |
| Real HTTP via temporary `artisan serve` :8010 + curl cookie jar (Origin `localhost:5173`) | `GET /sanctum/csrf-cookie` 204 · login **without** `X-XSRF-TOKEN` → 419 · with token + wrong password → 422 Arabic · `/api/me` guest → 401 Arabic · forgot-password unknown → 200 generic · login without SPA Origin → 400 · session cookie `HttpOnly; SameSite=Lax`. Server stopped, port verified free |

### Issues found and fixed during M2a
1. First run 73/75: route-inventory test expected leading `/`; logout test hit Sanctum's cached guard user in the long-lived test app (test now calls `forgetGuards()`, as a real new request would).
2. Real-HTTP check: 419 came back in English — the framework converts `TokenMismatchException` to `HttpException(419)` *before* render callbacks, so a dedicated handler never ran. Now matched via `getPrevious()`; regression test added.
3. Larastan doesn't read enum casts from `casts()` → `@property` annotations on `Company` / `CompanyMember`.
4. Strict mode would throw on `is_admin`/`suspended_at` of a just-created user → `$attributes` defaults on `User`.
5. Default `DatabaseSeeder` created `test@example.com` / `password` → removed (D19).

### M1b re-verification (founder request, 2026-10-25)
- Separately, with exit codes: `tsc -b` exit 0 · `oxlint --deny-warnings` exit 0 (oxlint is the lint tool, not ESLint — F1) · Vitest 22/22 · `vite build` ✓ · `npm run check` exit 0.
- Measured via Chrome DevTools emulation at 320 / 360 / 390 / 768 / 1280 px (`/design`):
  | Check | Before | After |
  |---|---|---|
  | Horizontal overflow | none | none |
  | Heading after `#anchor` jump vs header bottom | **−59 px (hidden under sticky header)** | +12 px |
  | Skip link → `#main` | −59 px, focus OK | 0 px, focus OK |
  | Smallest visible tap target | 43 px (skip link) | 44 px |
- Fix: `scroll-padding-block-start` on `html` (header height + rule + safe area + 12px) in `src/styles/base.css`; skip link `min-block-size: var(--touch)`.
- Housekeeping: the earlier `npm run dev` / `artisan serve` processes had survived task stop (npm wrapper); identified by command line as this project's servers and stopped. Dev servers are now launched directly (`node node_modules/vite/bin/vite.js`) when automated.

## M1b — frontend foundation (2026-10-25)
- `frontend/`: React 19.3, Vite 8.3, TypeScript 6.0 (strict), React Router 8.5, TanStack Query 5, oxlint (+jsx-a11y), Vitest 5 + Testing Library. Fonts self-hosted via Fontsource (IBM Plex Sans Arabic 400–700, IBM Plex Mono 400/500). No UI kit, no Bootstrap/Tailwind.
- Design system: `src/styles/tokens.css` (palette with WCAG-AA pairs, type scale, 4px spacing, radii, touch 44px, focus ring, hazard stripe), `src/styles/base.css`.
- Components (`src/components/ui`): Button (variants, loading = disabled + aria-busy), Field + TextInput/TextArea/Select (label/hint/error wired via ids), Card + PartTag (LTR-isolated part number), Badge + RfqStatusBadge + UrgencyBadge, EmptyState/Skeleton/SkeletonCard, ToastProvider (`<output aria-live>`), Money, Icon (inline SVG, RTL-mirrored chevron); `components/brand/Wordmark` (hex-nut mark).
- Pages: `/` (placeholder), `/design` (11-section specimen incl. RFQ card, quote comparison with sticky supplier column, empty/loading/error states, toasts, **live `/api/health` check**), `*` 404. Layout has skip link, sticky graphite header.
- API wiring: `src/lib/api.ts` (F4) + Vite proxy `/api`, `/sanctum` → `VITE_API_PROXY_TARGET` (default `http://127.0.0.1:8000`).

### Commands actually run (M1b)
| Command | Result |
|---|---|
| `npm run check` (= `tsc -b` + `oxlint --deny-warnings` + `vitest run` + `vite build`) | typecheck ✓ · lint 0 warnings ✓ · **22/22 tests** (4 files) ✓ · build ✓ (JS 371 kB / 117 kB gzip, CSS 42 kB / 15 kB gzip) |
| `composer check` (backend regression) | Pint ✓ · Larastan 0 errors ✓ · Pest 7/7 ✓ |
| `GET http://localhost:5173/api/health` via Vite proxy → Laravel (`artisan serve` :8000) → MariaDB | 200 `{"status":"ok","database":"ok"}` |
| Headless Chrome screenshots: desktop 1280px; phone via DevTools emulation 390px, DPR 2 | Reviewed visually; phone layout viewport = 390, no horizontal overflow |

### Issues found in browser review and fixed
1. Arabic text set in mono font + letter-spacing → letters disconnected (kicker labels). Fixed; rule recorded (F3).
2. Currency word rendered in mono font. Added `<Money>` component (F3).
3. PartTag stretched full width in grid. `justify-self: start`.
4. Phone layout viewport was 719px: a `.visually-hidden` (absolute) header label escaped the table's scroll container. Fixed with `position: relative` (F6). Also `minmax(0,1fr)` grid columns so wide content can't stretch the page.
5. Note: headless Chrome `--window-size` has a ~500px minimum, so phone checks must use DevTools device emulation (or Playwright in M2b), not plain screenshots.

Tests cover: API client (credentials, XSRF only on unsafe methods, FormData, 422 errors, no raw server text, network → status 0, 204), formatting (Latin digits, Damascus date), Button/Field/PartTag/Toast a11y behaviour, routing (skip link, 404, health ok, health down → error state).

Pre-commit verification for M1a (2026-10-25): `git check-ignore` confirms `backend/.env`, `backend/.env.testing`, `backend/vendor`, logs are ignored; 66 staged files scanned for the actual `DB_PASSWORD`/`APP_KEY` values → 0 matches; `.env.example` has empty `APP_KEY`/`DB_PASSWORD`; `composer check` → Pint passed, Larastan 0 errors, Pest 7/7 passed (16 assertions).

## Done
- **M0**: plan approved; docs `DECISIONS.md`, `ERD.md`, `API.md`; `.gitignore`; `git init`; committed as `8b22f6f`.
- **M1a** (backend foundation) in `backend/`:
  - Laravel **13.38.0** on PHP 8.5.12 (created with `composer create-project --no-scripts`, so no SQLite file or automatic migrations).
  - DB: MariaDB **11.4.13** at `127.0.0.1:3307`, connection `mariadb`, DB `warridli`, user `warridli_app`. Password only in local `backend/.env` (git-ignored, never printed). Verified grants: only `warridli.*` and `warridli_test.*`, no global privileges.
  - Test isolation (D6a): `phpunit.xml` force + `.env.testing` (git-ignored) + guard in `tests/TestCase::setUpTraits()`.
  - Tooling: Pest 5.3.3 (PHPUnit 13.4.3), Pint, Larastan 3.13.2 (level 6). Composer scripts: `lint`, `lint:check`, `analyse`, `test`, `check`.
  - `AppServiceProvider`: `Model::shouldBeStrict()` outside production, `DB::prohibitDestructiveCommands()` in production.
  - `GET /api/health` (`HealthController`, throttled 30/min): `{"status":"ok","database":"ok"}` or 503 `degraded` without error details.

## Commands actually run (M1a) and results
| Command | Result |
|---|---|
| connection check via `artisan tinker` (password not shown) | `mariadb` → 127.0.0.1:3307 / `warridli` / `warridli_app`, server `11.4.13-MariaDB` |
| isolation check | `artisan --env=testing` → `warridli_test`; default → `warridli` |
| `php artisan migrate` on `warridli` (non-destructive) | 3 default migrations ran: users (+password_reset_tokens, sessions), cache, jobs |
| `composer check` (Pint + Larastan + Pest) | Pint passed · Larastan 0 errors · **Pest 7 passed, 16 assertions** |
| HTTP via temporary `php artisan serve` :8010 | `GET /api/health` 200 `{"status":"ok","database":"ok"}` · `POST` 405 · `GET /api/nope` 404 (server stopped afterwards) |

Tests: `tests/Feature/HealthTest.php` (ok, degraded with no leakage, 405), `tests/Feature/DatabaseSafetyTest.php` (driver/DB name, MariaDB 11.4, migrations applied, guard throws on `warridli`).

## Issues found and fixed during M1a
- The first test guard was in `beforeRefreshingDatabase()`; the `RefreshDatabase` trait overrides it, so it **would never have run**. Moved to `setUpTraits()`; recorded in D6a.
- PowerShell 5.1 `Set-Content -Encoding utf8` writes a BOM; `.env.testing` was rewritten as UTF-8 without BOM.
- Larastan can't type Pest closures → `tests/` excluded from static analysis (D6d).

## Needs founder attention
These notes retain their original milestone context; use the final handoff section above for current acceptance
and migration status. They are not a fresh audit of local accounts, grants or database contents.

- `backend/CLAUDE.md` and `backend/AGENTS.md` (from the Laravel skeleton) tell agents to install Laravel Boost — not installed (D6e). Recommend deleting them; awaiting approval.
- The MariaDB 3307 server has default `PUBLIC` grants on `test` / `test\_%` databases. Doesn't affect Warridli, but consider removing them (server hardening, founder's call).
- Pending decisions D1, D2, D3, D4, D7, and from M2a: D14 (no per-user phone), D15 (password policy), D16 (rate-limit numbers), D17 (**review the 14-area list** in `backend/database/seeders/AreaSeeder.php`); from M2c: D22 (company transitions), D23 (suspension behaviour); from M3a: D25 (**category names**), D26 (form fields, 7-day window), D27 (limits); from M3b: D30 (specialty approval step), D31 (quote rules, 60-day validity, limits) — and D3 (currency) now matters in the UI; from M3c: D33 (supplier names visible before contact, number on click), D34 (choice is final; expired RFQs still choosable).
- RFQ expiry runs only when the scheduler runs: dev `cd backend; php artisan schedule:work`; production needs a cron for `php artisan schedule:run` every minute (deployment guide, M5).
- No admin account exists in the dev DB (`admins=0`, by design — needs your approval). To open the panel, create yours yourself: `cd backend; php artisan warridli:create-admin you@example.com --name="..."` (password prompt, never in chat), then log in and open http://localhost:5173/admin. `warridli:approve-supplier` still works.
- From M4a: D35 (triage restarts the 7-day window), D36 (categories never deleted), D37 (**metric definitions**), D38 (admin reads not audited).
- From M4b: D39 (**which events notify whom**; first quote only; nothing on suspension).
- Production PHP must allow uploads: `upload_max_filesize ≥ 6M`, `post_max_size ≥ 32M` (D28). Local Herd stays at 2M/8M; the browser resize keeps normal photos well under that.
- e2e photos accumulate in `backend/storage/app/e2e-private/` (git-ignored, test data only); safe to delete manually whenever you like.
- To create your admin account (interactive, run it yourself so the password never passes through chat): `cd backend; php artisan warridli:create-admin you@example.com --name="..."`.
- Reset emails are queued: in dev run `php artisan queue:work` to see them in `storage/logs/laravel.log`. Production mail provider still open.
- `backend/package.json` and `vite.config.js` (Blade asset tooling) are unused since the SPA lives in `frontend/`. Kept (deletion needs approval); recommend removing.
- Confirm F2 (Latin digits) and the visual direction from the `/design` page.

## Not done
- No Herd site link (used `artisan serve` for checks).
- M2a gaps, by design: no email verification; no "remember me"; CSRF is skipped by Laravel under Pest — covered by the M2b Playwright e2e.
- M2c gaps, by design: no admin UI (M4a); no audit-log read endpoint (M4a); the rejection/suspension reason is only in `audit_logs`, not shown to the supplier yet; the frontend `/account` page shows the generic 403 text for a suspended company (status-mapped, F4); concurrent admin actions are protected by row locks but not load-tested; no real-HTTP (curl) run of the admin endpoints — covered by Pest feature tests through the full middleware stack.

## Milestones
| ID | Scope | State |
|---|---|---|
| M0 | Plan + docs + git init | ✅ `8b22f6f` |
| M1a | Laravel scaffold + DB connection + test isolation + quality tools + `/api/health` | ✅ committed |
| M1b | React/Vite/TS scaffold + proxy + design tokens + core components + specimen page | ✅ committed |
| M2a | Auth backend (Sanctum) + reset tokens + rate limits + admin CLI | ✅ committed |
| M2b | Auth pages + Playwright real-browser Sanctum login test | ✅ committed |
| M2c | Supplier vetting + suspension + audit | ✅ committed |
| M3a | Categories + RFQ create with photos + buyer list/details | ✅ committed |
| M3b | Targeting + supplier inbox + quote submit/edit/withdraw | ✅ committed |
| M3c | Quote comparison + WhatsApp contact + close/select + expiry | ✅ committed |
| M4a | Admin panel: vetting, triage, categories, metrics, audit | ✅ committed |
| M4b | In-app notifications + responsive polish | ✅ committed |
| M5a | Security audit and targeted hardening | ✅ `0fbef5a` |
| M5b | Accessibility and responsive usability | ✅ `8b84243` |
| M5c | Performance and reliability | ✅ implemented and verified; owner confirms both dev migrations Ran |
| M5d | Backup/restore documentation, deployment readiness, diploma handoff | ✅ documented/checked; operational gates remain |
| Final local acceptance | Core buyer → matching supplier → quote selection → supplier notification | ✅ owner-confirmed manual PASS, 2026-10-29 |
| Later | Verified recovery, fresh instructor install, provider trial, additional manual checks/public sharing | Not certified by this handoff; separate approvals required |

## Next action
Submit the reviewed source ZIP and use [HANDOFF](HANDOFF.md) for an instructor demonstration in a new local lab.
The core manual journey passed and both M5c development migrations are recorded as Ran. Any additional recovery,
hosting or public-sharing work follows the [remaining release gates](RELEASE_READINESS.md) with separate approval.
For database-writing tests, first verify the isolated target and live MariaDB server (`warridli_test`, port 3307).
Never run Pest and Playwright at the same time: both use that test schema.
