# M5d release readiness and zero-cost demo assessment

Reviewed 2026-10-28, baseline `d5be2de` (clean M5c). M5d prepares documentation/handoff only; it does not certify
a public deployment. Existing security, accessibility, quote/matching rules and notification policy D39 are unchanged.

**Local handoff update, 2026-10-29:** the owner confirmed the core manual acceptance journey passed and both
M5c development migrations are Ran. See [STATUS](STATUS.md) for exact coverage and final automated results.
The M5d procedures and provider assessment below retain their original context; they do not authorize operations.

## What is ready, and what is not

| Item | State |
|---|---|
| Source/features and automated baseline | M5c: Pest 293/293, Vitest 127/127, Playwright 52/52; see STATUS for final handoff reruns |
| Instructor setup, blank test template, synthetic demo plan, export rules | Prepared in M5d; fresh instructor install still to rehearse |
| Backup/restore and deployment procedures | Prepared in M5d; final polish performs no backup/import/server activation |
| Owner development migrations | Owner confirms **both M5c migrations Ran** on development before final handoff |
| Backup integrity/recovery | Successful SQL/private-photo recovery rehearsal is not certified by this handoff |
| Public host/domain/HTTPS/SMTP/cron/worker | None provisioned or tested; free candidate assessment below |
| Core local manual acceptance | **Passed, owner-confirmed 2026-10-29**; broader manual coverage remains unclaimed |

## M5c migration gate

Historical procedure: the owner has now confirmed both migrations Ran;
**do not rerun these commands on `warridli` for handoff.**
Approval of M5d documentation does not authorize a development migration or a restore.

| File | Up / purpose | Down / risk |
|---|---|---|
| `2026_10_31_000002_add_expiry_lookup_index_to_rfqs_table.php` | Add `rfqs_status_deadline_id_index(status, closes_at, id)`; measured expiry scan 10,010 → 10 rows | Drops that index; DDL/table lock/time not measured on actual dev data |
| `2026_10_31_000003_preserve_quote_timestamp_microseconds.php` | Modify quotes.created_at and updated_at to nullable TIMESTAMP(6); preserve the seen quote version | Downgrade truncates fractional versions; **lossy**, not an automatic rollback |

The filenames follow the existing repository's October-31 sequence, not a claim that execution happened then.
They ran on the isolated test schema during M5c and were later applied to development, as owner-confirmed.
Quote resources/model already preserve fractions, so the complete same-second version guarantee needs the
schema change; do not claim an old schema
has that guarantee just because new code is checked out.

For a **new empty instructor/demo** schema, README setup runs all migrations; this existing-data gate instead
protects the owner's already completed database. Never reset/reseed it to obtain the new schema.

1. Obtain permission for a backup quiet window and **separately** for an isolated restore rehearsal. Follow
   [BACKUP_RESTORE](BACKUP_RESTORE.md): paired SQL/private-file capture, hashes, all-table counts, current commit,
   migrations, schema/precision/index metadata, securely retained APP_KEY. Complete and record the restore drill.
2. Prepare an isolated review of the restored copy's migration SQL/schema (not Pest against that schema).
   Keep restore application mail/workers/scheduler disabled. Review DDL locking/disk headroom; two MODIFYs may
   be separate statements and MariaDB DDL can commit partially. Stop if the source has unexpected objects/data.
3. Request the owner's **explicit approval to apply the two named migrations to `warridli`**, providing the
   verified backup reference, successful restore evidence, exact pretend SQL and recovery plan. This approval
   has **not** been granted by M5d. Do not ask for blind permission before the evidence is ready.
4. Only for the approved operation: pause application writes, uploads, scheduler, workers and other DB clients;
   keep a fresh consistent backup if data changed since rehearsal. Use a dedicated local terminal with no test
   environment pins. Verify the effective app target **before** any Artisan migration command. A read-only
   verification example from `backend` (it neither migrates nor prints credentials):

   ```powershell
   $inspection = @'
   <?php
   try {
       require 'vendor/autoload.php';
       $app = require 'bootstrap/app.php';
       $app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
       if ($app->configurationIsCached() || !$app->environment('local')) throw new RuntimeException();
       if (config('database.default') !== 'mariadb') throw new RuntimeException();
       $connection = Illuminate\Support\Facades\DB::connection();
       $c = $connection->getConfig(); // resolved by Laravel, no PDO query yet
       if (($c['driver'] ?? '') !== 'mariadb' || ($c['host'] ?? '') !== '127.0.0.1'
           || (string)($c['port'] ?? '') !== '3307' || ($c['database'] ?? '') !== 'warridli'
           || !empty($c['url']) || !empty($c['unix_socket']) || isset($c['read']) || isset($c['write'])) {
           throw new RuntimeException();
       }
       $s = $connection->selectOne('SELECT DATABASE() AS db, @@port AS port, VERSION() AS version');
       if ($s->db !== 'warridli' || (int)$s->port !== 3307
           || !str_starts_with($s->version, '11.4.') || !str_contains($s->version, 'MariaDB')) {
           throw new RuntimeException();
       }
       echo "PASS: expected existing development target verified; no migration performed.\n";
   } catch (Throwable) {
       echo "BLOCKED: target not verified; details suppressed.\n";
       exit(1);
   }
   '@
   $inspection | php
   if ($LASTEXITCODE -ne 0) { throw 'Stop without migration.' }
   ```

   This is **not** TestDatabaseSafety and is never to be used as a writing-test preflight. It intentionally
   authorizes no write. Cached config/URL overrides must be reviewed privately, not blindly cleared/ignored.

5. With existing `migrations` table confirmed, review `php artisan migrate:status`. Exactly these two should
   be pending; if others are pending, either already applied, or schema/repository state disagrees, stop for review.
   Inspect the exact SQL first; these commands are for the approved window, **not executed during M5d**:

   ```powershell
   php artisan migrate --pretend --path=database/migrations/2026_10_31_000002_add_expiry_lookup_index_to_rfqs_table.php --path=database/migrations/2026_10_31_000003_preserve_quote_timestamp_microseconds.php
   # Only after the approval + verified backup + checks above, in the same verified environment:
   php artisan migrate --path=database/migrations/2026_10_31_000002_add_expiry_lookup_index_to_rfqs_table.php --path=database/migrations/2026_10_31_000003_preserve_quote_timestamp_microseconds.php
   ```

   Check each exit code. No `--force` needed for this local operation, no migrations from other folders, no seeds.
   Any failure: keep writes paused, inspect actual schema/migration records and obtain review. Do not retry by
   resetting, dropping an index/column, truncating, restoring over development or doing a lossy down migration.

6. Verify the two new migration records, unchanged **application** row counts (migrations itself gains two),
   preserved values/relationships and private-file manifests. Read-only schema checks:

   ```sql
   SELECT INDEX_NAME, SEQ_IN_INDEX, COLUMN_NAME FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='rfqs' AND INDEX_NAME='rfqs_status_deadline_id_index'
     ORDER BY SEQ_IN_INDEX;
   SELECT COLUMN_NAME, DATA_TYPE, DATETIME_PRECISION, IS_NULLABLE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='quotes' AND COLUMN_NAME IN ('created_at','updated_at');
   ```

   Expect index order status/closes_at/id, TIMESTAMP precision 6 and nullable YES. Legacy seconds become
   fractional zero, not new quote edits. Record results before resuming approved service processes. Run writing
   regressions only on `warridli_test:3307`; any development human workflow remains separately approved.

## Can the actual application be shared for zero hosting/domain cost?

**A small public diploma demo is plausible, but not yet verified.** A free provider subdomain avoids a domain
purchase. PHP/MariaDB, private durable photos, safe same-origin routing, scheduler and asynchronous password mail
must all work together. No free account, capacity, country eligibility, payment-method requirement or route/session
behavior was verified by logging in or deploying. Sources below were read on 2026-10-28; recheck before choosing.

| Option | Verified published facts | Assessment for THIS application |
|---|---|---|
| **alwaysdata Free** | Published free offer: **1 GB disk, 256 MB RAM, ¼ CPU**, provider subdomain; PHP 8.5/8.4 and MariaDB 11.4 are documented | Strongest small-demo candidate found. Need verify free-account cron availability/cadence, CLI/web extension parity, quotas including DB/photos/logs, same-origin Apache routes and SMTP. No application deployment verified |
| Render Free | Free service has ephemeral files, no persistent disk; PHP uses Docker; managed DB offerings are not MariaDB | Does not meet this unchanged app's durable local photos + MariaDB needs. External durable services/storage migration would add unverified infrastructure; not a proven zero-cost complete setup |
| InfinityFree | Provider's Laravel guide states no Artisan shell, cron or long-running queue workers | Not compatible with the unchanged scheduler/queued-recovery operation. Do not switch async mail to sync or skip expiry just to fit hosting |
| Oracle Always Free VM | Always Free compute/storage documented; capacity limits, card/phone verification for most signups, idle reclamation | Possible self-managed stack in principle; eligibility/capacity/admin effort/TLS/subdomain and complete operation unverified. Trial credits are not a lasting zero-cost plan; no account created |
| Free static SPA hosting | Cloudflare documents React/Vite static deployment | Frontend asset hosting only. Does not supply this Laravel/MariaDB application or same-origin API routing by itself; not a working full-stack demo |

Official evidence: [alwaysdata free plan](https://www.alwaysdata.com/en/offers/),
[PHP versions/configuration](https://help.alwaysdata.com/en/docs/web-hosting/languages/php/configuration/),
[MariaDB versions](https://help.alwaysdata.com/en/docs/web-hosting/databases/mariadb/).
The offer page currently says 1 GB; do not substitute old third-party 100 MB descriptions.
[Scheduled tasks](https://help.alwaysdata.com/en/docs/web-hosting/tasks/),
[paid-only persistent services](https://help.alwaysdata.com/en/docs/web-hosting/services/) and
[subdomain HTTPS](https://help.alwaysdata.com/en/docs/web-hosting/sites/ssl-tls/lets-encrypt/) explain the relevant
hosting capabilities; these are platform documents, **not proof of features granted to a specific free account**.

Render limitations: [free services](https://render.com/docs/free), [PHP via Docker and datastore options](https://render.com/docs/faq).
InfinityFree limitations: [provider-authored Laravel guide](https://forum.infinityfree.com/t/how-to-install-a-laravel-site-on-infinityfree/118578).
Oracle conditions: [Free Tier](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier.htm),
[Always Free idle/capacity limits](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm).
Static frontend scope: [Cloudflare React guide](https://developers.cloudflare.com/pages/framework-guides/deploy-a-react-site/).

### Conditional alwaysdata validation plan — not performed

1. Owner verifies personal/educational eligibility, actual zero-price limits and account availability from their
   location, without assuming a trial, paid upgrade or purchased domain. Obtain separate account/deployment approval.
2. Confirm selectable PHP 8.5 for CLI/web and MariaDB 11.4, all required extensions/GD formats, upload/memory limits,
   persistent private directories, account quota and correct database network/TLS. Build the SPA off-host to avoid
   memory pressure; install only locked production vendor dependencies in the release artifact/server.
3. Use the free provider subdomain with HTTPS, **one origin**, backend/public root plus reviewed SPA rewrite rules
   as in [DEPLOYMENT](DEPLOYMENT.md). Verify API/CSRF/deep routes and missing-chunk behavior on synthetic data.
4. Services/daemons are paid-only per provider docs. Check whether a free per-minute command task can process the
   **existing** database mail queue with `--stop-when-empty` and bounded timeout/memory, alongside schedule:run.
   This preserves D5's asynchronous mail; no new queue architecture or code change. If that is unavailable or
   unreliable under 256 MB limits, **full workflow compatibility remains blocked**, rather than silently disabling it.
5. Verify SMTP is available, sender accepted and messages actually received by a controlled address; assess worker
   delays/errors. Do not present log mail or a success response without delivery as working account recovery.
6. Rehearse backup/isolated restore, restart persistence, quota behavior, health/errors, then seek final acceptance
   and public-demo approval. Keep backups off-host too; provider backup retention is not a tested recovery plan.
   Maintain the free account's activity requirements: [provider inactivity policy](https://help.alwaysdata.com/en/docs/admin-billing/profile/alerts-notifications/).

If a complete free setup cannot be verified, submit the source ZIP + reproducible local instructor setup and a
synthetic-data recording/screenshots prepared in a later approved demonstration. A recording is not a live demo.
Do not expose the owner's laptop, real data or credentials, buy services or change product policy as a workaround.

## Decisions and release blockers

- The owner confirms both development M5c migrations are Ran. A fresh empty demo/instructor schema remains
  separate from development; retain private backup/recovery evidence without resetting existing data.
- Select/verify hosting, HTTPS and same-origin routing, persistent storage, SMTP and queue/scheduler execution.
  Confirm provider terms/account access for the owner; no location/legal eligibility claim is made here.
- D3: SYP denomination/currency wording; initial category/area hypotheses; D30 specialty approval and D33
  supplier-name/contact visibility; D34 final choice/expiry semantics; D35 triage window/rejection visibility;
  D37 metrics, D38 audit reads and D39 event list remain owner decisions. Current code stays unchanged.
- M5a finding: admin audit metadata exposes quote prices despite buyer-only wording. **Owner must explicitly
  resolve intended admin access before public sharing**; M5d neither removes data nor approves that policy.
- Email verification is not implemented; choose a launch policy and real recovery provider. No shared public
  admin account, real personal data/photos or production claims in a diploma demo. Decide privacy/retention,
  backup schedule/RPO/RTO and operational ownership before collecting real user data.
- The project has framework/dependency licenses but no new project-wide distribution license was chosen here;
  owner/instructor should agree on repository visibility and attribution before public source publication.

## Remaining final acceptance and potential demo steps

1. Review docs/source archive; have the instructor follow README in a fresh local lab. Confirm actual runtimes,
   empty-schema setup, no fixed credentials and all dependencies locked. This cold install was not performed in M5d.
2. Verify and retain SQL/private-photo recovery evidence separately. Both development migrations are owner-confirmed Ran;
   do not repeat them or reset the owner's database for an instructor demonstration.
3. Resolve release-blocking business/privacy decisions. Choose public-demo scope and synthetic-only data.
4. Separately approve a provider proof-of-concept; verify zero cost, same-origin sessions/CSRF, persistent photos,
   mail queue/SMTP, scheduler, logs, backup/rollback, restarts, limits and secret/path denial.
5. Rerun backend/frontend/browser checks against verified isolated test infrastructure. Obtain explicit approval
   for the human buyer/supplier/admin [demonstration/negative checks](HANDOFF.md#suggested-1015-minute-instructor-demonstration),
   narrow-screen/keyboard review, recovery and conflict paths. Record pass/fail, evidence and limitations.
6. Only after those gates, approve limited public sharing of the demo link. No such acceptance or sharing occurred in M5d.
