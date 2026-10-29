# ERD (MVP draft — `users`, `areas`, `companies`, `company_members`, `audit_logs` built in M2a)

All tables InnoDB, `utf8mb4_unicode_ci`, FKs enforced. Timestamps omitted below unless meaningful.

M5c migrations (implemented/tested, **not applied to owner development**): add
`rfqs_status_deadline_id_index(status, closes_at, id)` and widen nullable `quotes.created_at/updated_at` to
TIMESTAMP(6) for exact seen-version checks. Existing development schema must be verified before assuming
those changes are present. See the [approval and backup gate](RELEASE_READINESS.md#m5c-migration-gate).

| Table | Columns | Constraints / indexes |
|---|---|---|
| `users` | id, name, email, password, is_admin bool, suspended_at null, email_verified_at null (no `phone`: D14) | email unique |
| `companies` | id, type enum(buyer,supplier), name, whatsapp_phone, area_id, address_text null, status enum(pending,approved,rejected,suspended) (transitions: D22), verified_by null → users, verified_at null (= last approve/reject decision) | idx(type, status) |
| `company_members` | id, company_id, user_id, role enum(owner,member) | **unique(user_id)** (D9), unique(company_id,user_id) |
| `areas` | id, name_ar, sort | seeded, admin-editable |
| `categories` (**built M3a**, admin CRUD M4a) | id, slug, name_ar, is_active, sort | slug unique; idx(is_active, sort); never deleted (D36) |
| `supplier_categories` (**built M3b**) | id, company_id (cascade), category_id (restrict), status enum(pending,approved), approved_by null → users, approved_at null | **unique(company_id, category_id)** (surrogate id instead of composite PK so Eloquent can update/delete); idx(category_id, status) |
| `rfqs` (**built M3a**) | id, ulid, buyer_company_id, created_by → users, category_id **null** (= unknown), status, description text, part_number null, machine_make null, machine_model null, quantity uint, unit enum(piece,set,meter), area_id, urgency enum(normal,urgent,line_stopped), closes_at (= created + 7 days, D26), selected_quote_id null → quotes (nullOnDelete, **built M3c**; same RFQ enforced in SelectQuote + test); triaged_by null → users (nullOnDelete) + triaged_at null (**built M4a**) | ulid unique; idx(status, category_id, created_at); idx(buyer_company_id, created_at); CHECK quantity > 0; FKs restrict on delete |
| `rfq_attachments` (**built M3a**) | id, rfq_id, path (generated, unique), mime, size, width, height, created_at | FK cascade on rfq delete; files on the private `local` disk under `rfq-photos/{rfq ulid}/{ulid}.jpg` |
| `quotes` (**built M3b**; valid_until DATE, notes ≤1000) | id, rfq_id, supplier_company_id, submitted_by → users, unit_price DECIMAL(14,2), currency, condition enum(new,used,refurbished), brand null, origin null, stock_status enum(in_stock,on_order), lead_time_days, fulfillment enum(pickup,supplier_delivery,either), valid_until, notes null, status enum(submitted,withdrawn) | **unique(rfq_id, supplier_company_id)**; idx(supplier_company_id, created_at); CHECK unit_price > 0 |
| `contact_events` (**built M3c**) | id, rfq_id (cascade), quote_id (cascade), user_id (restrict), channel enum(whatsapp), created_at | idx(rfq_id, created_at) |
| `audit_logs` | id, actor_user_id null, action, subject_type, subject_id, meta json, ip, created_at | idx(subject_type, subject_id); idx(actor_user_id, created_at) |
| `notifications` (**built M4b**) | Laravel's shape (uuid id, type = kind, notifiable morph `user`, json data, read_at, timestamps(6)) + `dedupe_key` | **unique(notifiable_type, notifiable_id, dedupe_key)** (D39); idx(notifiable, created_at); idx(notifiable, read_at) |
| `password_reset_tokens`, `sessions`, `jobs` | Laravel standard | — |

`rfqs.selected_quote_id` must reference a quote of the same RFQ — enforced in the Action (transaction), plus test.

## RFQ state machine
```
pending_review ──(admin sets category)──▶ open ──▶ closed     (buyer done / selected quote)
      │                                     ├──▶ cancelled  (buyer)
      └──▶ rejected (admin, spam)           └──▶ expired    (closes_at passed; scheduler + guard on quote submit)
```
- Known category → `open` immediately; unknown → `pending_review`.
- `expired` = no new quotes; the buyer can still choose a received quote or close (`expired → closed`, D34).
- Transitions only via Actions using conditional `UPDATE ... WHERE status = ?` (idempotent, race-safe).
- Quote expiry is derived from `valid_until` at read time (no job).
