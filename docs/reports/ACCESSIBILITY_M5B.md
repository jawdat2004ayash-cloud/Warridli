# M5b — accessibility, responsive usability and essential UX

Historical milestone report. See [current status](../STATUS.md) for later verification and release limitations.

Date: 2026-10-28. Baseline: clean `0fbef5a`. Scope: M5b only.

## Approach and coverage

The reference is [WCAG 2.2](https://www.w3.org/TR/WCAG22/), particularly labels/relationships, contrast,
reflow, keyboard access, page titles, focus order/visibility, error identification and status messages.
This is a practical source/browser audit, not a declaration of full WCAG conformance.

- Reviewed the Arabic RTL shell, design tokens, fields, summaries, notices/toasts, loading/empty/error
  components, account/auth pages, buyer RFQs/comparison, supplier specialties/inbox/quotes, admin workflows
  and notifications. Existing native radio/checkbox groups, autocomplete, skip navigation and semantic
  specimen table headers were retained. Confirmations remain inline, not modal dialogs or keyboard traps.
- New deterministic browser fixtures cover **24 role/page combinations** across guests, buyers, suppliers
  and admins. The layout matrix checks **144 combinations** of page/viewport/browser profile, at widths
  **320, 360, 390, 768 and 1280 CSS pixels**, using installed Chrome. Fixtures include a long Arabic account
  name, long part numbers, mixed currencies and the largest permitted unit price.
- Checks include Arabic language/direction, one main landmark/primary heading, visible control names,
  valid accessible-name/description references, keyboard focus, horizontal page overflow and screenshots.
  Horizontal scrolling inside the existing admin section strip is intentional; page overflow is not.
- Existing real-API browser journeys remain separate and cover registration/login/CSRF, RFQ uploads,
  targeting/quotes, comparison/contact/selection, moderation and notifications.

## Confirmed issues fixed

1. **Header overflow with long names:** the buyer/supplier shell exceeded 320 px by 49 px in the initial
   audit. The account link and its name can now shrink/truncate while preserving the brand, bell, full
   accessible account name and existing navigation. No link or capability was removed.
2. **Large price overflow/readability:** a permitted long price caused another 35 px of page overflow in
   comparison. Long unit prices use a smaller existing type token only in narrow comparison containers,
   and stay on one line as a number. Currency, formatting, arithmetic and selection rules are unchanged.
3. **Buyer/supplier confirmation focus:** choosing a quote, closing/cancelling a request and withdrawing a
   quote replaced the focused trigger without moving focus to the question. A small shared presentation
   component uses a named native fieldset, focuses the question, supports Escape when not pending, and
   restores the reinserted trigger on cancellation. It does not intercept Tab or change any mutation.
4. **Contact disclosure focus:** revealing a supplier's number removed the focused button. Focus now moves
   to the named contact region, with the WhatsApp action next in normal keyboard order. The existing
   authenticated, rate-limited contact endpoint and safe external link are unchanged.
5. **Page orientation:** every route used the same document title and SPA navigation left focus at the old
   location. Routes now have generic Arabic task titles and a named main landmark; pathname navigation
   focuses/scrolls to main. Initial load preserves skip-link-first keyboard navigation. Query-only filters
   do not reset focus. Titles exclude names, RFQ descriptions, emails and reset-token query strings.
6. **High contrast focus/selects:** Chrome forced-colour mode removed box-shadow focus rings and gradient
   select arrows. System-colour outlines now remain visible, including hidden-input labels; selects regain
   their native affordance. Normal branding, colours and focus rings are unchanged.
7. **Image error feedback:** local picker errors were neither announced nor associated with the upload
   input. They now have an alert and a description reference. Server photo errors remain linked to the
   input but are announced by the focused form summary, avoiding duplicate alerts.
8. **Password-reset errors:** invalid submits did not move focus, and corrected fields retained errors.
   Reset now uses the existing focused/linkable summary pattern and clears a field's error on edit without
   stealing focus. Server password errors, including M5a rejections, follow the same pattern. Password and
   token rules are unchanged.
9. **Arabic admin conflicts:** triage/rejection conflict text had corrupt encoding. Only the explanatory
   strings/comment were corrected. Regression assertions verify the exact Arabic text and unchanged RFQ
   state/audit behavior, including a category deactivated after validation.

## Verification

- Database-writing checks are preceded by the existing M5a resolved-configuration/live-server verification:
  MariaDB 11.4, loopback port 3307, **`warridli_test` only**, no cached configuration for backend runs. Checks
  print only success/failure markers. Backend and browser suites run sequentially against the shared test
  schema. The dev schema, environment files and credentials were not changed.
- Baseline `composer check`: Pint passed, Larastan 0 errors, **283/283 Pest**, **1442 assertions**.
- Initial `npm run e2e -- e2e/accessibility.spec.ts --project=desktop`: **1 passed / 8 failed**. This exposed
  the focus, title, upload-description, forced-colour and header issues; one generic-name assertion was a
  test error because it included controls inside closed `details` elements. It now checks visible controls.
- Next focused browser run: **8 passed / 1 failed**, exposing the large-price overflow after header repair.
- Intermediate `npm run check`: **126 passed / 1 failed** (127 tests). The photo server-error test detected
  duplicate alerts; local/server announcement responsibilities were corrected. TypeScript/oxlint also caught
  early test-module import and native-fieldset/ref issues, corrected without weakening configuration/rules.
- Intermediate full `npm run e2e`: **40 passed / 2 failed** (42 tests). Both failures were the new loading/
  empty/error fixture intercept matching only URLs with query parameters; the first page has no query.
  The route matcher was corrected. Existing real-API journeys passed in both browser profiles.
- Arabic conflict red regressions: `php artisan test tests/Feature/Admin/RfqTriageTest.php`: **12 passed /
  6 failed** before the text fix. The first final backend check stopped on Pint import ordering; targeted
  Pint corrected it, with no unrelated formatting.
- Final `composer check`: Pint passed, Larastan **0 errors**, **284/284 Pest**, **1451 assertions**.
- Final frontend `npm run check`: TypeScript, oxlint and build passed; **127/127 Vitest** (14 files).
- Final `npm run e2e`: **46/46 passed**, **0 skipped**, **3.4 minutes**. Additional cases cover contact disclosure focus, one-line long prices,
  200% root text sizing at a 1280 px viewport, and 19 intended contrast pairs (4.5:1 text, 3:1 input borders).
- Build still reports the pre-existing bundle-size warning. Performance work was not started.
- Targeted formatter command: `php vendor/bin/pint tests/Feature/Admin/RfqTriageTest.php app/Actions/Admin/TriageRfq.php`.
- `git diff --check` passed. Scanning changed/new files for local secret values returned no matches without
  printing the values; dependency manifests/lockfiles, migrations, policies and M5a hardening files are unchanged.
- Final read-only socket check confirmed that test-server ports 8020 and 5174 were free.

Screenshots are generated under git-ignored `frontend/test-results/`. The 320 px account overflow was
inspected before repair; buyer comparison/large numbers, admin triage and 200% text were inspected after repair.
Layout/typography inspection is agent QA using synthetic data, not final human acceptance testing.

## Limits and preserved decisions

- No NVDA/JAWS/VoiceOver listening session, axe engine, Firefox, Safari, real-device or final human
  acceptance test was performed. Accessible names/relationships/focus and intended colour pairs are tested;
  full screen-reader announcement behavior and every composite/background/hover state are not certified.
- Narrow layout checks use CSS viewport resizing. The text-size check changes root font size, not browser
  zoom; 200% text on every narrow viewport, arbitrary user spacing/styles and all OS native pickers remain
  outside this verification. Reduced-motion CSS was retained and reviewed, not exhaustively device-tested.
- Admin audit quote-price visibility and all pending product decisions remain unchanged. M5a byte/NUL
  validation, cache/session clearing, private-photo `no-store`, test isolation and server authorization are
  preserved and included in regression checks.
- No migrations/reset/restore/truncation targeted development, no dependency install/upgrade or Boost,
  no production connection/deployment/paid integration. M5c performance, backups and deployment/final
  acceptance were not started.
