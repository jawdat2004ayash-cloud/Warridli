# API contract (draft — refined per milestone)

Base: same-origin `/api`. Auth: Sanctum SPA cookies; call `GET /sanctum/csrf-cookie` first; send `X-XSRF-TOKEN`. JSON errors: `422 {message, errors}`, `401`, `403`, `404` (also used to hide others' resources), `419` (CSRF), `429` (throttle). Lists are paginated (`?page=`, default 20).

## Auth (M2a, built) — throttled (D16)
| Method | Path | Who | Notes |
|---|---|---|---|
| POST | `/api/auth/register` | guest (SPA session) | body (D14): `name, email, password, password_confirmation, account_type, company_name, whatsapp_phone, area_id, address_text?` → 201 `{data: Me}` and logged in; supplier company `pending`. 409 if already logged in, 400 without SPA session |
| POST | `/api/auth/login` | SPA session | `email, password` → 200 `{data: Me}`; regenerates session. 422 same message for unknown email / wrong password; 403 suspended |
| POST | `/api/auth/logout` | auth | 204; invalidates session + CSRF token |
| GET | `/api/me` | auth | 200 `{data: Me}`; 403 + logout if suspended |
| POST | `/api/auth/forgot-password` | guest | `email` → always 200 with the same message (D5) |
| POST | `/api/auth/reset-password` | guest | `token, email, password, password_confirmation` → 200; 422 `errors.token` (one message for invalid/expired/used/unknown) |
| GET | `/api/areas` | public | `{data: [{id, name}]}` sorted |

`Me` = `{id, name, email, is_admin, company: null | {id, type, name, whatsapp_phone, area: {id, name}, address_text, status, role}}` — explicit allow-list (no password/remember_token/timestamps).

No endpoint exists for admins to read or set passwords (enforced by a route-inventory test). Admins are created only via `php artisan warridli:create-admin` (D19).

## Categories (M3a, built)
`GET /api/categories` — public, throttled 60/min → `{data: [{id, slug, name}]}`, active only, admin order (`sort`). Seeded hypotheses (D25); admin CRUD in M4a.

## Buyer RFQs (M3a, built) — `auth:sanctum` + `active` + `throttle:api`, authorized by `RfqPolicy`
Only members of an **approved buyer company** may list/create (supplier/admin → 403 «طلبات الأسعار متاحة لحسابات المشترين…»). Ownership is per company. Another company's RFQ, its photos and its actions → **404** (same as unknown/malformed ULID), never 403.

| Method | Path | Notes |
|---|---|---|
| GET | `/api/rfqs?page=` | own company, newest first, paginated 20 → `{data: [Rfq], links, meta}` with `photos_count` (no `photos`) |
| POST | `/api/rfqs` | `multipart/form-data`, throttle `rfq-create` (5/min + 40/day per user, D27). Fields: `description` (3–2000), `part_number?` (≤100), `machine_make?`, `machine_model?` (≤100), `quantity` (int 1–100000), `unit` (piece\|set\|meter), `urgency` (normal\|urgent\|line_stopped), `area_id`, **`category`** = active category id **or `"unknown"`** (→ `pending_review`), `photos[]?` (≤5, each ≤5 MB, real JPEG/PNG/WebP, ≤16 MP). → 201 `{data: Rfq}` with `photos`. Authorization checked before validation. 413 Arabic if the whole body exceeds PHP `post_max_size` |
| GET | `/api/rfqs/{ulid}` | `{data: Rfq}` with `photos: [{id, url, width, height}]` |
| POST | `/api/rfqs/{ulid}/cancel` | `pending_review\|open → cancelled`; 409 Arabic otherwise; audited `rfq.cancelled` |
| GET | `/api/rfqs/{ulid}/photos/{id}` | the re-encoded JPEG; photo must belong to that RFQ (scoped binding); headers `Content-Type: image/jpeg`, `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store` (M5a; also supplier/admin photos), `Content-Security-Policy: default-src 'none'` |

`Rfq` = `{id (ULID), status, category: null | {id, slug, name}, description, part_number, machine_make, machine_model, quantity, unit, urgency, area: {id, name}, closes_at, created_at, photos_count, photos?}` — no company/user ids, no file paths. Status/ownership fields in the body are ignored. Audit: `rfq.created` (meta `status, category_id, photos`), `rfq.cancelled` (meta `from`).

## Buyer quotes, choice, contact, close (M3c, built) — owner company only (else **404**); `{id}` of a quote is scope-bound to the RFQ (another RFQ's quote → 404)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/rfqs/{ulid}/quotes` | `{data: [BuyerQuote]}` — submitted quotes of still-approved suppliers (withdrawn / suspended hidden), cheapest first per currency. Not paginated (bounded by approved suppliers per category) |
| POST | `/api/rfqs/{ulid}/quotes/{id}/select` | body `seen_updated_at` (the quote's `updated_at` as displayed). `open\|expired → closed` with `selected_quote_id`; row locks RFQ → quote. **409** (Arabic): RFQ not open/expired, quote withdrawn / supplier no longer approved, price expired (`valid_until` < today Damascus), quote changed since seen. Same quote again → 200, no new audit (double click). Audited `rfq.quote_selected` (meta from, quote_id, supplier_company_id, unit_price, currency) |
| POST | `/api/rfqs/{ulid}/close` | `open\|expired → closed` without a choice; 409 otherwise; audited `rfq.closed` |
| POST | `/api/rfqs/{ulid}/quotes/{id}/contact` | throttle `contact` (20/min, 200/day per user) → `{data: {phone, whatsapp_url}}` (`https://wa.me/963…?text=…` prefilled with the request). Allowed: RFQ open/expired → any visible quote; closed → only the chosen one; else 409. Each call writes a `contact_events` row |

`BuyerQuote` = `{id, supplier: {name, area}, unit_price, currency, condition, brand, origin, stock_status, lead_time_days, fulfillment, valid_until, price_expired, notes, updated_at, selected}` — **no phone** (only via `/contact`), no supplier ids. Buyer `Rfq` now also has `accepts_quotes` (false once `closes_at` passed) and `selected_quote_id`; `quotes_count` counts the same visible quotes. Supplier `my_quote` gains `selected` (true only for the chosen supplier; nothing about the winner is shown to others).

M5c: quote `updated_at` is ISO 8601 UTC with six fractional digits (including `.000000Z` for legacy whole-second
records). Echo this exact string as `seen_updated_at`; do not round it or convert through JavaScript `Date`.
Edits within one second must also invalidate a stale choice (D34). This requires the new timestamp-precision
migration; it has been verified on the isolated test schema and is **not applied to development** without approval.

Scheduler: `warridli:expire-rfqs` every 15 min marks `open` RFQs past `closes_at` as `expired` (audited `rfq.expired`, no actor); quotes are already refused after `closes_at` before it runs. Needs `php artisan schedule:work` (dev) or a cron `schedule:run` (prod).

Frontend error text (F11): for 403/409 the SPA shows the server's `message` when it is Arabic (our business rules), otherwise the generic status message.

## Supplier specialties (M3b, built) — any supplier company (also `pending`)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/supplier/categories` | `{data: [{id, name, status: null\|pending\|approved}]}` — all active categories with this supplier's status |
| PUT | `/api/supplier/categories` | `{category_ids: [int]}` (active ids, may be `[]`) → new ones `pending`, unchecked removed, approved stay approved; audited `supplier_category.requested/removed`. Buyer/admin → 403 |

## Supplier inbox + quotes (M3b, built) — middleware `supplier` (approved supplier company, before model binding, D24)
Pending/rejected supplier, buyer, admin → **403 with the Arabic reason for every URL, also unknown ULIDs** (no probing). Per-RFQ visibility (D30) = `Rfq::visibleToSupplier`: `open` + `closes_at` in the future + category **approved** for this supplier, **or** already quoted by it. Anything else (other category, `pending_review`, expired, cancelled-and-not-quoted, unknown) → **404**.

| Method | Path | Notes |
|---|---|---|
| GET | `/api/supplier/rfqs?tab=new\|quoted&page=` | `new` (default) = quotable and not yet quoted; `quoted` = has own quote (any status, any RFQ status). Newest first, 20/page → `{data: [SupplierRfq], links, meta}` |
| GET | `/api/supplier/rfqs/{ulid}` | `{data: SupplierRfq}` with `photos` |
| GET | `/api/supplier/rfqs/{ulid}/photos/{id}` | same headers as the buyer photo route; the buyer route stays 404 for suppliers |
| PUT | `/api/supplier/rfqs/{ulid}/quote` | create / edit / re-submit the company's single quote. Throttle `quote-submit` (20/min, 300/day per user). Body: `unit_price` (numeric, >0, ≤2 decimals, ≤999,999,999,999.99), `currency` (SYP\|USD), `condition` (new\|used\|refurbished), `brand?`, `origin?` (≤100), `stock_status` (in_stock\|on_order), `lead_time_days` (required if on_order, 1–365; forced 0 if in_stock), `fulfillment` (pickup\|supplier_delivery\|either), `valid_until` (Y-m-d, today..today+60 in Damascus), `notes?` (≤1000). Visibility checked **before** validation (foreign RFQ → 404 even with a bad body). **409** if the RFQ no longer accepts quotes or the category approval was removed (re-checked under a row lock). Audited `quote.submitted / quote.updated (meta changed=field names) / quote.resubmitted` |
| POST | `/api/supplier/rfqs/{ulid}/quote/withdraw` | own submitted quote, RFQ still accepting → `withdrawn`; else 409. Audited `quote.withdrawn` |

`SupplierRfq` = `{id, status, accepts_quotes, category, description, part_number, machine_make, machine_model, quantity, unit, urgency, area, closes_at, created_at, photos_count, photos?, my_quote: null | Quote}` — **no buyer company/name/phone/user (D4), never another supplier's quote** (the eager load is constrained to the own company). `Quote` = `{status, unit_price (decimal string), currency, condition, brand, origin, stock_status, lead_time_days, fulfillment, valid_until, notes, updated_at}`. Buyer `Rfq` now has `quotes_count` (submitted only); the quotes themselves come in M3c.

## Admin — supplier specialties (M3b, built; panel in M4a)
`POST /api/admin/supplier-categories/{company}/{category}/approve` · `/reject` (`reason?`; reject deletes the pending request) → `{data: AdminCompany}`; 409 if no pending request; audited `supplier_category.approved/rejected`. `AdminCompany` now includes `categories: [{id, name, status}]`.
CLI (until M4a): `php artisan warridli:approve-supplier {email} [--force]` — approves a pending/rejected supplier company and all its pending specialties via the same actions; audited with no actor (CLI).

## Admin — vetting & suspension (M2c, built)
Middleware `auth:sanctum` → `active` → `throttle:api` → `admin` (active, non-suspended `is_admin`). `active` and `admin` run **before** route model binding, so a non-admin gets **403 for every admin URL, existing ID or not** (no ID probing); guest 401. Every successful change writes one `audit_logs` row; refused requests write none.

| Method | Path | Body | Result |
|---|---|---|---|
| GET | `/api/admin/companies` | query `status?` (pending\|approved\|rejected\|suspended), `type?` (buyer\|supplier), `page?` | 200 paginated (20) `{data: [AdminCompany], links, meta}`; `status=pending` oldest first, otherwise newest first. 422 on unknown filter values |
| POST | `/api/admin/companies/{id}/approve` | `reason?` | supplier `pending\|rejected → approved`; sets `verified_by/at` |
| POST | `/api/admin/companies/{id}/reject` | **`reason`** (5–500) | supplier `pending → rejected`; sets `verified_by/at` |
| POST | `/api/admin/companies/{id}/suspend` | **`reason`** | any company `approved → suspended`; all members blocked at once + their stored sessions deleted |
| POST | `/api/admin/companies/{id}/reactivate` | `reason?` | `suspended → approved` |
| POST | `/api/admin/users/{id}/suspend` | **`reason`** | sets `suspended_at`, rotates remember token, deletes the user's sessions → `{data: {id, name, suspended}}` |
| POST | `/api/admin/users/{id}/reactivate` | `reason?` | clears `suspended_at` |

Errors: **409** + Arabic message when the action does not fit the current state (e.g. «لا يمكن تنفيذ الموافقة على شركة حالتها الآن «معتمدة»…»), for approve/reject on a buyer company, and for any admin account (incl. self — admins are CLI-managed, D19); 422 `errors.reason`; 404 unknown company/user/action (admins only). Status fields in the body are ignored — the URL action decides.

`AdminCompany` = `{id, type, name, whatsapp_phone, area: {id, name}, address_text, status, verified_at, created_at, members: [{user_id, name, email, role, suspended}]}` (allow-list; no password/tokens).

Audit actions: `company.approved|rejected|suspended|reactivated` (meta `from, to, company_type, reason, sessions_revoked`), `user.suspended|reactivated` (meta `reason, sessions_revoked`); actor = admin, subject = company/user, plus `ip`, `created_at`.

Effect on other endpoints: a suspended user **or a member of a suspended company** gets 403 + logout on any authenticated request and at login (distinct Arabic message for each). Supplier routes (M3b) will use `can:approved-supplier`: 403 with an Arabic reason for pending / rejected / suspended / non-supplier.

## Admin panel endpoints (M4a, built) — same `admin` middleware (403 for non-admins before model binding, 401 guests)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/admin/companies?pending_categories=1&q=` | (M2c endpoint, extended) `pending_categories` = suppliers of any status with a specialty waiting (oldest first); `q` (2–100) = company name or member email, LIKE wildcards escaped |
| GET | `/api/admin/rfqs?status=&page=` | default `pending_review`, oldest first (other statuses newest first), 20/page → `{data: [AdminRfq], links, meta}` |
| GET | `/api/admin/rfqs/{ulid}` | with `photos` (admin photo URLs) |
| GET | `/api/admin/rfqs/{ulid}/photos/{id}` | scoped to the RFQ; same safe headers as buyer/supplier photo routes |
| POST | `/api/admin/rfqs/{ulid}/triage` | `category_id` (active) → `pending_review → open`, `closes_at` = now + 7 days (D35), `triaged_by/at`; audited `rfq.triaged`. 409 if not pending (another admin / buyer cancelled) or the category was deactivated meanwhile (re-checked under lock) |
| POST | `/api/admin/rfqs/{ulid}/reject` | **`reason`** (5–500) → `rejected`; audited `rfq.rejected` (reason in meta). 409 if not pending |
| GET | `/api/admin/categories` | all, active first then `sort` → `{data: [AdminCategory]}` |
| POST | `/api/admin/categories` | `name_ar` (2–100, unique, spaces collapsed), `sort?` (0–9999, default last+10) → 201; slug generated (`c-<ulid>`), client slug/id/is_active refused or ignored; audited `category.created` |
| PATCH | `/api/admin/categories/{id}` | any of `name_ar`, `sort`, `is_active`. Audited `category.updated` (meta `changed`, `name_from`) or `category.activated/deactivated`; no-op → no audit. **No delete route** (D36) |
| GET | `/api/admin/metrics?period=7\|30\|90\|all` | default 30 → see definitions below (D37) |
| GET | `/api/admin/audit-logs?group=&actor=admin\|system&subject_type=&subject_id=&from=&to=&page=` | newest first, 30/page; `group` = action prefix (`company`, `rfq`, …); dates are Damascus days. Read-only (no write/delete route) |

`AdminRfq` = `{id, status, category, description, part_number, machine_make, machine_model, quantity, unit, urgency, area, buyer: {company_id, name, whatsapp_phone}, closes_at, created_at, triaged_at, photos_count, photos?}` — never quotes or supplier data. `AdminCategory` = `{id, slug, name, is_active, sort, rfqs_count, open_rfqs_count, suppliers_count (approved)}`. `AuditEntry` = `{id, action, actor: null | {id, name, email, is_admin}, subject: null | {type, id, label, ref (RFQ ULID)}, meta (scalar values; keys matching pass/token/secret/remember/cookie are dropped), ip, created_at}`.

**Metric definitions (D37)** — period = RFQs *created* in the last N days: `rfqs.created` (all statuses, `by_status` breakdown) · `published` = has a category (buyer-chosen or triaged; excludes pending/rejected) · `with_quote` = has ≥1 quote row (also one later withdrawn) · `with_quote_rate` = with_quote / published (null if 0) · `with_selection` = closed with a chosen quote · `first_quote.median_minutes` = median of (first quote − RFQ created_at) over quoted RFQs, with `sample` · `triage.median_minutes` = median of (triaged_at − created_at) · `contacts.reveals` / `.rfqs` = `contact_events` in the period · `queue` (not period-bound) = pending suppliers, pending specialties, pending_review RFQs.

## Notifications (M4b, built) — `auth:sanctum` + `active` + `throttle:api`; always the current user's own rows (D39)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/notifications?page=` | newest first, 20/page → `{data: [Notification], links, meta: {…, unread}}` |
| GET | `/api/notifications/unread-count` | `{data: {unread}}` — polled every 60 s by the header bell (A4), only for company members |
| POST | `/api/notifications/{uuid}/read` | `{data: Notification}`; idempotent. Someone else's / unknown / non-UUID id → **404** |
| POST | `/api/notifications/read-all` | marks only the caller's unread rows → `{data: {unread: 0}}` |

`Notification` = `{id (uuid), kind, data, read, created_at}` — never the recipient columns or the dedupe key. `data` = `{rfq_id (ULID), description (≤80 chars), category}` for request events, `{category}` for specialty events, `{}` for account events: nothing the recipient cannot already see (no prices, phones, buyer identity, rejection reasons).

| kind | Trigger (inside the action's transaction) | Recipients (active members) | Once per |
|---|---|---|---|
| `supplier_approved` / `supplier_rejected` | admin (or CLI) approves / rejects a supplier company | that supplier company | audit event |
| `specialty_approved` / `specialty_rejected` | specialty decision | that supplier company | audit event |
| `rfq_matched` | RFQ created with a category, or triaged | every approved supplier company approved in that category (= `Rfq::quotableBy` audience) | RFQ |
| `rfq_triaged` / `rfq_rejected` | admin triage decision | buyer company | RFQ |
| `quote_received` | a supplier's **first** submission (edits / withdraw + re-submit do not notify again) | buyer company | quote |
| `quote_selected` | buyer chooses a quote | the chosen supplier company only (others get nothing, D33) | RFQ |

Not notified (by design): suspension (the user is logged out), reactivation, quote edits/withdrawals, RFQ expiry/cancel/close. Events before M4b were not back-filled.

## Common
`GET /api/categories`, `GET /api/areas`, `GET /api/health`.
