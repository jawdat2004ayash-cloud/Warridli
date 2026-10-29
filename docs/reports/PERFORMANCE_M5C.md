# M5c — performance and reliability

Historical milestone report. See [current status](../STATUS.md) for later verification and the owner-confirmed
development migration status; the statements below describe M5c's original scope.

Date: 2026-10-28. Clean baseline: `8b84243` (M5b). Scope: measured query/build improvements and
targeted reliability corrections, preserving M5a, M5b and D30–D39. No M5d, deployment or human acceptance.

## Safety and method

- Every backend writing run was preceded by a resolved-config **and live-server** check using
  `App\Support\TestDatabaseSafety::verifyServer()`: testing environment, MariaDB, loopback, port **3307**,
  schema **warridli_test**, no DB URL/socket/read/write override or cached config. Process variables pinned
  that target; credentials were read by the application without being displayed or changed.
- Pest uses the existing guarded `RefreshDatabase`; Playwright's existing setup verifies the same live
  target before its isolated migrate/seed/cache preparation. These suites never ran concurrently.
- **Neither new migration was applied to development `warridli`.** Only the isolated test schema was migrated.
  No dependencies, lockfiles, credentials, server settings, existing migrations or product decisions changed.
- Local MariaDB 11.4.13; synthetic factories, 25-row API fixtures, 10,010-row expiry fixture and 1,201-recipient
  notification fixture. HTTP feature counts include authentication/authorization work. Query logging and
  JSON `ANALYZE` instrument the tests; this is not production-like load, concurrent traffic or a capacity claim.
- Optional `M5C_PROFILE=baseline|after` writes only synthetic aggregate measurements beneath ignored
  `backend/storage/framework/testing/`. No development data was sampled or exported.

## Findings and changes

### 1. Expiry lookup scanned future requests

Exact first expiry chunk: `status = open AND closes_at <= now`, select `id, closes_at`, order by `id`, limit 200.
Fixture: 10,000 future requests followed by 10 due requests. MariaDB's actual `ANALYZE FORMAT=JSON` showed:

| Evidence | Baseline | With proposed index |
|---|---|---|
| Access/key | index / PRIMARY | range / rfqs_status_deadline_id_index |
| Actual rows examined (`r_rows`, one loop) | 10,010 | 10 |
| Eligible rows returned | 10 | 10 |
| Seven warm reads, median | 2.666 ms | 0.499 ms (green profiling run) |

The existing `(status, category_id, created_at)` index cannot narrow the deadline in this query.
Authored an additive `(status, closes_at, id)` index in
`2026_10_31_000002_add_expiry_lookup_index_to_rfqs_table.php`. It keeps `chunkById(200)` and all matching,
status and ordering semantics. The regression checks actual rows read (≤20), not noisy timing or a required
optimizer key. Timings vary between runs; the row-count change is the stronger result. No hints, cache or queue.

### 2. Expiry transition could lose its audit event

Previously the conditional UPDATE committed independently of the audit INSERT. Injecting an audit failure
left an expired RFQ with no event; retry skipped it. Each RFQ's existing conditional UPDATE and audit now
share one transaction. Earlier successfully committed RFQs stay committed, and the failed RFQ is retryable.
Regression injects a logger exception, verifies rollback, then verifies one successful transition/event on retry.
Expiry still sends no notification (D39); pending-review and other non-open states are unchanged.

### 3. Quote version lost same-second edits

D34 already requires the buyer's seen `updated_at`; storage and API formatting previously truncated seconds.
A supplier edit 100 ms later could be chosen using the unseen older price. The red test reproduced that, plus
the same frozen clock instant. New `2026_10_31_000003_preserve_quote_timestamp_microseconds.php` widens
the two nullable quote timestamps to TIMESTAMP(6); the model writes fractional timestamps and the two quote
resources return ISO 8601 with six fractional digits. Existing RFQ row locks still serialize edits/selections.
For an equal/backward clock, model-generated versions advance at least one microsecond; trusted explicit
timestamps retain their meaning. No new version field, selection rule or API route.

Tests reject stale versions for forward/equal/backward clocks, leave the RFQ open with no selection audit,
then accept the refreshed quote. A legacy whole-second timestamp remains selectable (including the old
ISO spelling). Existing idempotency, withdrawal, expiry, role/privacy and notification tests remain.
Clients must echo `updated_at` verbatim as `seen_updated_at`, without rounding via JavaScript `Date`.

**Migration handoff:** the index and full version fix require separately approved development migration.
The test-only pretend run emitted one ADD INDEX and two MODIFY TIMESTAMP(6) statements, without DML.
Up preserves existing timestamps; down of the precision migration loses fractional precision. Table size,
DDL locking/time and optimizer choices on real data were not measured. No development migration or rollback
was run. Migration names continue the repository's existing 2026-10-31 sequence.

### 4. Initial frontend build loaded every page

Baseline Vite emitted a single 520.34 kB JS entry and warned about a chunk over 500 kB. All authentication,
buyer, supplier, admin and design specimen pages were statically imported. Pages now load by route using
React's built-in lazy/Suspense facilities; home/not-found and guards remain eager. No new dependencies or
manual vendor chunk rules. The page shell remains mounted while code loads, preserving skip-link/main focus.
A failed chunk gets a generic Arabic error, focused main and a full reload retry; no raw error or private data.

`node scripts/measure-build.mjs` follows the entry's **static** manifest imports, excluding dynamic pages,
and sums actual bytes and Node `gzipSync` bytes per file (same compression method before/after, decimal kB).
Vite's displayed gzip estimator uses a different default; its rounded numbers must not be mixed with this table.

| Production artifact | Baseline | M5c |
|---|---:|---:|
| Initial JS, including static dependencies | 520,345 B | 384,843 B |
| Initial JS, gzip | 150,801 B | 121,953 B |
| Initial CSS | 68,485 B | 41,971 B |
| Initial CSS, gzip | 19,435 B | 15,321 B |
| All JS chunks, even pages never visited | 520,345 B | 540,667 B |
| All JS chunks, gzip separately | 150,801 B | 182,819 B |

Initial JS decreases **26.0% raw / 19.1% gzip**. Splitting increases total all-route bytes and request count:
6 initial JS files, 44 JS files in the full build. This trades loading every role's code up front for loading
the required page on demand; no full-app download or latency improvement is claimed. Vite's >500 kB warning
is gone. Fonts, branding and public routes are unchanged. No speculative prefetch of private-role pages.

The baseline was measured before splitting and reproduced without checking out or rewriting source files:
Vite's pre-load plugin supplied only `git show 8b84243:frontend/src/app/router.tsx` to the original page graph,
with output in ignored `backend/storage/framework/testing/m5c-baseline-build` (`emptyOutDir: false`).
`node scripts/measure-build.mjs ../backend/storage/framework/testing/m5c-baseline-build` measures that artifact.
The new manifest contains paths/hashes only and is emitted to ignored `frontend/dist/.vite/manifest.json`.

Production Playwright tests serve `dist` on an ephemeral loopback port with synthetic API fixtures: home
doesn't request login/admin/design page chunks, navigation requests the needed chunk, guards still redirect
guests, failed chunks expose only generic Arabic retry text, and delayed chunks preserve skip-link focus.
Existing real-API journeys still verify Sanctum/CSRF and buyer/supplier/admin isolation.

## Queries already bounded; behavior preserved

| Synthetic request | Returned | SQL queries (baseline → after) | Baseline JSON bytes |
|---|---:|---:|---:|
| Buyer RFQ page | 20 | 6 → 6 | 12,753 |
| Supplier new inbox | 20 | 7 → 7 | 12,351 |
| Buyer quote comparison | 25 | 6 → 6 | 10,070 |
| Notifications | 20 | 5 → 5 | 3,411 |
| Admin companies | 20 | 8 → 8 | 11,444 |
| Admin audit (company subjects) | 25 | 5 → 5 | 9,704 |
| Admin open RFQs | 20 | 6 → 6 | 13,934 |
| Supplier quoted inbox | 20 | 7 → 7 | 17,789 |

No N+1 was demonstrated in these paths; existing eager loading and constrained own-quote loading were kept.
Full-page query budgets guard against regressions. Payload sizes include synthetic random names/descriptions,
so small before/after byte differences are not claimed as improvements. Audit pages allow 30; this fixture has 25.
Specialty queue with 25 categories: **8 queries**, 2,956 bytes (final run); approval returns all 25 in **12 queries**.
A repeated approval correctly returns the existing 409, with one audit and one notification total.

Existing pagination is 20 for RFQs/inbox/companies/notifications and 30 for audit. Stable tie-breaks are already
present in the reviewed ordering. Filters remain validated/parameterized; escaped admin substring search and
queue ordering are unchanged. Existing composite/unique indexes cover tenant/recipient lookup and quote/dedupe
identity. No additional index was added without a measured plan justifying it.

D39 matching fanout for **1,201 active members**: **6 SQL statements** (audience/category lookups plus three
500-recipient INSERT chunks), 1,201 rows, retry inserts **0**. Baseline 72.106 ms, initial after run 42.388 ms:
unchanged code and noisy local timing, **no speedup claimed**. Existing transaction rollback, suspended-user
exclusion, first-quote-only, recipient privacy and deduplication tests are retained. Fanout still materializes its
audience in memory; this synthetic fanout does not prove thousands of supplier companies can be served under load.

## Limits and deferred work

- Buyer comparisons intentionally return every eligible quote for client-side per-currency sorting; no hard
  row cap. Areas/categories and nested company members/specialties are also unpaginated. Arbitrary caps would
  hide valid choices/history; changing that contract needs evidence and a separate design decision.
- Admin metrics still aggregate on request; first-quote/triage medians materialize values in PHP, especially
  `period=all`. No representative historical workload was available to justify changing D37 or adding caching.
- Deep offset pages, large wildcard searches, mixed audit subject types, true lock contention/deadlocks,
  notification memory at much larger fanout, scheduler overlap and long sustained traffic were not load-tested.
- No evidence justified React memoization, list virtualization or a new query/cache/queue architecture.
  Existing bounded lists and query caches remain. Build compression numbers are artifact measurements,
  not mobile network, first-paint or throughput benchmarks.
- Chrome used desktop/mobile viewport profiles; no real-device, Firefox/Safari or constrained-network profiling.
- Open business decisions, including admin audit quote-price visibility, remain explicitly unchanged.

## Verification log

- Baseline `composer check`: Pint passed, Larastan 0 errors, **284/284 Pest, 1451 assertions**.
- Baseline `npm run build`: passed, one 520.34 kB JS entry, >500 kB warning.
- Initial focused red `php artisan test tests/Feature/PerformanceProfileTest.php tests/Feature/Rfqs/QuoteComparisonTest.php`:
  **21 passed / 3 failed (24 total)**, reproducing same-second/equal-clock selection and audit rollback failures.
- After fixes, same focused command: **24/24 passed, 181 assertions** (before extra review/legacy/backward cases).
- Expanded focused run: **25 passed / 1 failed (26 total)**: test incorrectly expected repeat specialty approval
  to be 200. Corrected the test to the established 409; business behavior was never changed.
- Final backend `composer check`: Pint passed, Larastan **0 errors**, **293/293 Pest, 1541 assertions**.
  This includes exact supplier-resource timestamp round-tripping in all three same-second clock cases.
- Initial lazy-route frontend check: **125 passed / 2 failed (127 total)** due to first lazy-module transforms
  exceeding Testing Library's 1-second polling timeout. Kept assertions and allowed 3 seconds for async imports.
  Subsequent `npm run check`: TypeScript, oxlint, **127/127 Vitest**, build passed.
- Separate e2e TypeScript check passed with `npx --no-install tsc --ignoreConfig --noEmit --target ES2023
  --module nodenext --strict --allowImportingTsExtensions --types node --skipLibCheck e2e/production.spec.ts`.
  First invocation required TypeScript 6's `--ignoreConfig`; corrected without source/config changes.
- Initial full `npm run e2e`: **48 passed / 2 failed (50 total, 0 skipped)**. Both failures reproduced early
  skip-link focus loss with router-level lazy initialization. Replaced it with React lazy/Suspense **inside**
  the persistent layout; kept every route/guard wrapper as before. New delayed-chunk cases explicitly cover it.
- A subsequent check caught the existing Fast Refresh lint rule for lazy components declared alongside exported
  route data. Moved those component exports to `LazyPages.tsx`; no lint suppression. Final `npm run check`
  passed TypeScript/oxlint, **127/127 Vitest**, and build. Separate e2e TypeScript check also passed again.
- Focused `npm run e2e -- production.spec.ts accessibility.spec.ts -g "production|keyboard skip"`:
  **8/8 passed (15.6 s), 0 skipped**.
- Second full browser run: **50 passed / 2 failed (52 total, 0 skipped, 4.0 min)**. Both new slow-chunk cases
  used an ambiguous `[aria-busy=true]` selector that matched the visible fallback and React's retained hidden
  auth placeholder. Changed the test to wait for the actual intercepted chunk request, then assert keyboard
  focus before/after release. No production behavior or accessibility assertion was weakened.
- Final `npm run e2e`: **52/52 passed (4.0 min), 0 skipped**, desktop + mobile Chrome; includes the original
  46 journeys/checks plus 6 production-build cases. No final failed checks. No realistic load test, deployment
  or final human acceptance was performed. `git diff --check` passed; known local credential values were
  checked against changed/untracked deliverables in memory, with **0 matches** and no values displayed.
