# M5a security audit and targeted hardening

Historical milestone report. See [current status](../STATUS.md) for later verification and release limitations.

Date: 2026-10-28. Baseline: `477e4f2` (clean working tree). Scope: M5a only.

## Review coverage

- Authentication: registration, login, logout, password broker, admin CLI, session regeneration/invalidation,
  suspension, password validation, Sanctum stateful origins, CSRF and CORS.
- Authorization: route middleware and its order before bindings; company ownership in policies and list
  queries; supplier approval/category targeting; nested quote/photo bindings; admin-only decisions.
- Data exposure: buyer/supplier/admin Resources, competing quotes, contact disclosure, notification ownership,
  audit metadata, private uploads, browser caches and frontend query caches.
- Input/abuse boundaries: FormRequests and allow-listed writes, rate limiters, fixed/parameterized SQL,
  image MIME/pixel/size limits and re-encoding, error handling, redirects and React text rendering.

No buyer/supplier/admin API authorization bypass or cross-company quote disclosure was identified in the
reviewed paths. Existing negative authorization, upload, lifecycle, rate-limit and browser CSRF tests remain
part of the regression checks. This is a scoped source review and local automated verification, not a claim
that every possible attack has been tested.

## Confirmed findings and fixes

### S1 — bcrypt input length and NUL handling

The existing 72-character rule accepted multibyte passwords exceeding bcrypt's 72-byte input limit. The
runtime accepted the hash while ignoring the suffix. Embedded NUL input passed validation but caused a 500
in registration/reset and an exception in the admin CLI.

The shared password defaults now reject inputs longer than 72 UTF-8 bytes and inputs containing NUL before
hashing. Minimum length, letters/numbers and confirmation rules are unchanged. Arabic field errors are
returned by the API; the CLI rejects the input without an account/audit write. Login compatibility and
existing account hashes are unchanged. Regression tests cover all three creation/reset paths, preservation
of reset tokens/sessions on rejection, and a valid multibyte password exactly at the byte boundary.

Existing hashes cannot reveal whether an older password originally exceeded the byte limit. No accounts
were inspected or forced to reset; any policy for existing affected accounts needs founder approval.

### S2 — previous identity's frontend cache survived a new login/registration

Only logout cleared the query cache. If a session expired without logout, successful login/registration
replaced `me` while retaining company-specific RFQs/notifications under shared query keys. Cached data
could be reused for the next identity in the same SPA instance.

Every successful login, registration and logout now clears the query/mutation caches, cancels old query
requests and then publishes the new identity. Two regressions seed previous-company private data and an
in-flight request, then verify removal/cancellation on login and registration. Existing auth UI flows pass.

### S3 — private photos remained fresh in browser caches after authorization changed

Photo responses used `private, max-age=3600`. This excludes shared caches but permits the same browser to
reuse a fresh photo without contacting the authorization endpoint after logout/account change/suspension.

All buyer/supplier/admin photo responses now use `private, no-store`; MIME, CSP, ownership checks and image
bytes are unchanged. Three regressions cover the roles, preserved content and guest rejection. The browser
RFQ journey also asserts `no-store`. This does not retroactively remove photos already cached under the old
header or user-saved downloads.

### S4 — test guards trusted a raw schema name without validating the complete target

The old backend/e2e boot guards accepted `warridli_test` on another host/port, and did not parse an overriding
database URL. Browser setup had a separate resolved-name check, but it did not establish the correct server.

The shared guard now resolves URLs and requires the dedicated MariaDB driver, loopback host, port 3307 and
test schema; separate read/write targets and Unix sockets are refused. PHPUnit and e2e pin the target without
changing stored credentials. Browser preparation verifies the live schema, server port and MariaDB 11.4
version before migration/seed/cache writes. Native PHP arguments avoid shell quoting and PsySH history in
that preflight. Ten negative regressions check host, port, URL override and read/write overrides (including
URL query options) for the backend/e2e guards without connecting to the unsafe targets.

## Preserved controls and decisions

- Sanctum cookies, CSRF checks, active/admin/supplier middleware, scoped bindings, company policies,
  validated allow-listed writes, audit decisions and per-user notification scoping remain in place.
- CORS retains the framework defaults: public wildcard origins without credential support. The same-origin
  SPA does not need credentialed cross-origin access. No origins, credentials or environment files changed.
- User content is rendered as React text; inspected links use application-generated relative paths or the
  fixed WhatsApp origin. No HTML rendering sink was identified. Uploads remain private, bounded and re-encoded.
- Production debug defaults remain disabled; local developer settings were not changed. No production
  connection or deployment configuration was exercised.

## Decisions/limitations requiring separate approval

- **Admin audit price visibility:** `SubmitQuote`/`SelectQuote` already record prices in audit metadata and the
  admin audit endpoint/UI expose them. The specification's buyer-only quote wording and D35's “never quotes”
  wording conflict with this existing operational audit behavior. Non-admins cannot read the audit endpoint.
  Preserve the existing behavior pending an explicit decision about admin-visible prices; no silent redaction
  or expansion of admin privileges was made.
- Email verification, production mail delivery, category/currency validation and other pending ADRs remain
  unresolved. Password-reset `log` delivery is still the documented local behavior.
- Accessibility review, query/performance work, backup/restore, deployment and final manual acceptance were
  not started. No dependency advisory service or external integration was contacted; dependencies are unchanged.

## Verification

- Before backend writes, a PHP bootstrap preflight checked resolved configuration, absence of cached config,
  and read-only live server results. It printed only a success/failure marker, not environment values.
- Baseline: `composer check` passed (263 Pest tests / 1371 assertions; Pint; Larastan 0 errors).
  Frontend `npm run check` passed (123 Vitest tests, typecheck, oxlint, build) after the sandbox retry below.
- Red regressions: new backend hardening tests had 1 pass, 8 failures and 1 error; eight unsafe-target tests
  failed as expected; both frontend cache tests failed as expected. These establish the pre-fix behavior.
- Focused checks: backend 23/23 (80 assertions); frontend auth/cache 15/15. Final review added two more
  URL-query read/write override cases, included in the full check below.
- Full final checks: `composer check` passed, Pest **283/283**, **1442 assertions**, Pint passed, Larastan
  **0 errors**. `npm run check` passed, Vitest **125/125**, TypeScript and oxlint passed, build passed.
- Playwright: **18/18 passed** (desktop 1280 + mobile 360, installed Chrome, 1.7 minutes), covering auth/CSRF,
  buyer/supplier isolation, quotes/selection/contact, admin decisions and notifications. RFQ photos assert
  `no-store`. After the last guard refinement, its read-only live-server verification passed again.
- TypeScript and oxlint were rerun after the final browser-preflight invocation change; both passed.
- Resolved execution issues: initial sandboxed frontend check stopped with Windows `spawn EPERM` before
  Vitest could load; approved retry outside the sandbox passed. One backend filter invocation failed because
  its pipe character reached a Windows shell; explicit test-file arguments passed. The first e2e attempt
  stopped at the new preflight invocation, before any preparation/tests; native PHP invocation replaced it.
  A sandboxed diagnostic Tinker call also stopped because PsySH history writes were disallowed.
  The read-only port cleanup check needed an approved retry after Windows denied CIM access; both test ports
  were confirmed free.
- The existing Vite warning about a minified chunk over 500 kB remains; it was not addressed in M5a.
- Changed/new files were checked against local secret values without printing them: no matches. Dependency
  lockfiles are unchanged. Git whitespace validation passed.

No development-schema migration/reset/restore/truncation, credential change, dependency installation,
destructive Git command, external service or deployment was performed. Database writes were confined to
the verified test schema; browser uploads used the existing separate e2e storage root.
