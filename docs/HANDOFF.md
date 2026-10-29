# Instructor handoff and demonstration checklist

Updated 2026-10-29: the owner confirmed the **core local manual end-to-end acceptance test passed** and both
M5c development migrations are Ran. [STATUS](STATUS.md) records the exact journey and final automated results;
the broader demonstration below is a checklist, not a claim that every step was manually verified.
Use the [root README](../README.md) for fresh setup and [release gates](RELEASE_READINESS.md) before public access.

## What to submit

- Source ZIP from an explicitly selected Git commit, both dependency lockfiles, blank environment templates,
  migrations/seeders/tests, root README and docs. No database export is needed: reference seeders + synthetic
  registration supply a reproducible demo without copying the owner's accounts or photos.
- Keep a private original Git repository for development history if the instructor requests provenance.
  A source ZIP does not include `.git`; review the **entire history** before publishing a repository.
  `.gitignore` does not remove previously committed secrets. No public repository/push was made in M5d.
- Keep `.env`, actual keys/passwords/tokens, composer auth.json, .npmrc credentials, SQL/backups, logs, uploads,
  vendor/node_modules, generated caches/builds, Playwright traces/screenshots and local IDE state out of submission.
  Preserve tracked `.gitignore` skeletons under storage/cache so fresh Laravel setup has its directories.
- The archive is **source**, not a deployment artifact. A separate future production artifact includes locked
  production vendor dependencies and built SPA files but still excludes real secrets/data from public serving.

## Instructor local setup

These are instructions for the recipient, **not commands executed on the owner's existing environment**.
Never run `composer setup`, `migrate:fresh`, `db:wipe`, resets or restores against an existing database.
On the owner's checkout, stop before any migration: use the [M5c approval gate](RELEASE_READINESS.md#m5c-migration-gate).
Generated `backend/AGENTS.md` / `backend/CLAUDE.md` Boost setup instructions are not project requirements.

1. Extract the reviewed source ZIP or clone the instructor-approved repository. Install the prerequisites
   yourself. Keep both lockfiles. In a new checkout, install the locked dependencies:

   ```powershell
   Set-Location backend
   composer install --no-interaction
   Set-Location ../frontend
   npm ci
   Set-Location ..
   ```

   Do not use `composer update` / `npm update`. No install or dependency upgrade was performed during M5d.

2. Have the database administrator provision **new empty** `warridli_instructor` and `warridli_test` schemas
   on MariaDB 11.4.x, port 3307, with utf8mb4 and a dedicated local user scoped to those two lab schemas.
   Do not give that user access to the owner's `warridli` or unrelated XAMPP schemas. No database dump is supplied.

3. In `backend`, copy templates **only if the destination does not exist**, then edit privately:

   ```powershell
   if ((Test-Path .env) -or (Test-Path .env.testing)) { throw 'Existing configuration: review instead of overwriting.' }
   Copy-Item .env.example .env
   Copy-Item .env.testing.example .env.testing
   ```

   | Setting | New `.env` | New `.env.testing` |
   |---|---|---|
   | APP_ENV | local | testing |
   | APP_URL | http://localhost:8000 | http://localhost:8000 |
   | FRONTEND_URL | http://localhost:5173 | http://localhost:5173 |
   | DB_CONNECTION / HOST / PORT | mariadb / 127.0.0.1 / 3307 | same |
   | DB_DATABASE | **warridli_instructor** (override the dev template!) | **warridli_test** |
   | DB_USERNAME / DB_PASSWORD | your dedicated lab credentials | your dedicated lab credentials |
   | DB_URL / DB_SOCKET | absent or empty | absent or empty |

   Leave mail as `log` locally; testing template uses `array`. Never paste passwords/keys into chat or commit them.
   Generate keys **only for these new environment files**, never regenerate an existing installation's key:

   ```powershell
   php artisan key:generate
   php artisan key:generate --env=testing
   ```

4. Independently verify the selected **new** schema, live server port/version and that it has zero tables
   using your database client (`SELECT DATABASE(), @@port, VERSION();`). Check the effective app database
   in your local configuration without sharing secrets; do not rely on the filename alone. Only then,
   on this new instructor installation:

   ```powershell
   php artisan migrate --pretend
   php artisan migrate
   php artisan db:seed
   php artisan warridli:create-admin instructor-admin@example.test --name="Instructor Admin"
   ```

   Seeders add only areas/categories, **no accounts or fixed passwords**. Choose a unique password at the
   hidden admin prompt. The example address is synthetic and cannot receive recovery email.

5. Open separate local terminals (loopback only):

   ```powershell
   # backend terminal
   php artisan serve --host=127.0.0.1 --port=8000
   # frontend terminal (in frontend/)
   npm run dev -- --host 127.0.0.1
   # optional backend terminals, against the new instructor schema
   php artisan schedule:work
   php artisan queue:work
   ```

   Open **http://localhost:5173** (not port 8000). Vite proxies `/api` and `/sanctum`; keep the browser hostname
   consistent. The backend root shows Laravel's welcome view, not the SPA. Reset emails appear in a private
   local log only after the queue worker runs; logs contain reset links and must not be submitted.


## Reproducible source ZIP

Run from the project root **after** reviewing and committing the intended changes. `git archive` includes only
tracked files, applies `.gitattributes` export exclusions and omits Git history/untracked dependencies.
Never use a file-manager ZIP of the working directory. The ignored `artifacts/` directory is for local delivery.

```powershell
$releaseCommit = (git rev-parse --verify HEAD).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Invalid commit.' }
if (git status --porcelain) { throw 'Review uncommitted files first.' }
if (!(Test-Path -LiteralPath artifacts)) { New-Item -ItemType Directory -Path artifacts | Out-Null }
$sourceZip = "artifacts/Warridli-source-$($releaseCommit.Substring(0,7)).zip"
if (Test-Path -LiteralPath $sourceZip) { throw 'Do not overwrite a reviewed archive.' }
git archive --format=zip "--output=$sourceZip" $releaseCommit
if ($LASTEXITCODE -ne 0) { throw 'Archive failed.' }
Get-FileHash -LiteralPath $sourceZip -Algorithm SHA256
```

Inspect ZIP member names and privately scan text for known local secrets before sending; do not print secrets.
Require root `README.md`, composer/package lockfiles and both `backend/.env.example` and
`backend/.env.testing.example`. Reject real environment files, dumps, private data, dependency/build directories,
or unexpected additions. Open/extract the reviewed ZIP in a **new** instructor lab directory and follow README;
do not run its migrations over the owner's checkout. Archive/hash creation is not proof of fresh installation.
Generated backend Boost instruction files are export-excluded; Boost is not needed.

## Test preflight

For local DB-writing checks only. Create/configure the separate test schema/credentials privately first.
In a **dedicated new PowerShell terminal**, from `backend`, run this read-only preflight, then the authorized
test command only if it succeeds. Closing the terminal discards these process-level pins; do not reuse it for
normal development administration. Never log complete resolved configuration or exception text.

```powershell
$env:APP_ENV='testing'
$env:APP_DEBUG='false'
$env:DB_CONNECTION='mariadb'
$env:DB_HOST='127.0.0.1'
$env:DB_PORT='3307'
$env:DB_DATABASE='warridli_test'
$env:DB_URL=''
$verification = @'
<?php
try {
    require 'vendor/autoload.php';
    $app = require 'bootstrap/app.php';
    $app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
    if ($app->configurationIsCached() || !$app->environment('testing')) throw new RuntimeException();
    App\Support\TestDatabaseSafety::verifyServer();
    echo "PASS: effective configuration and live isolated test target verified.\n";
} catch (Throwable) {
    echo "BLOCKED: verification failed; connection details suppressed.\n";
    exit(1);
}
'@
$verification | php
if ($LASTEXITCODE -ne 0) { throw 'Stop: no database-writing checks are authorized with this configuration.' }
# Only after PASS, if you intend to rebuild the disposable test schema:
composer check
```

The guard rejects URLs resolving elsewhere, sockets/read-write overrides, other engines/schemas/ports, and the
live check requires MariaDB 11.4.x. Do not clear a cached live configuration just to force this preflight through;
first isolate the test checkout/environment and review it. `composer check` itself clears its config cache.
Playwright's existing global setup performs its own live verification before preparing `warridli_test`;
run `npm run build` then `npm run e2e` in frontend after backend checks finish. Do not run test suites concurrently
against the same database. Browser credentials come from backend `.env` / process variables; never paste them
into a command line. Do not point tests at the restore lab to prove a backup.

## Suggested 10–15 minute instructor demonstration

Prepare **synthetic** buyer, two suppliers and an admin in the instructor schema, with locally chosen unique
passwords. Use separate browser profiles/sessions so roles cannot accidentally share a login. No fixed credentials
are supplied. Do not publish admin access or use real contact details/photos. Use reserved `example.test` emails;
choose valid-format synthetic phone data strictly for the isolated demo and **do not open/send WhatsApp messages**.

| Step | Show / expected outcome |
|---|---|
| 1 | Explain one-part RFQs, Arabic RTL/mobile use, roles and server-side privacy; no ecommerce/compatibility promise |
| 2 | Buyer registration → approved buyer; supplier registration → pending; supplier cannot quote yet |
| 3 | Supplier requests a specialty; admin approves **company and specialty**; approval notifications appear |
| 4 | Buyer creates a known-category RFQ with a harmless sample photo; matching approved supplier sees it; buyer identity stays hidden |
| 5 | Buyer chooses «لا أعرف التصنيف» on a second RFQ; supplier cannot see it until admin classifies it; show triage flow |
| 6 | Two approved suppliers quote on the same RFQ; each sees only their own quote, never their competitor's price |
| 7 | Buyer compares private quotes per currency (no conversion), explicitly reveals contact, then confirms a selection; RFQ closes |
| 8 | In a separate synthetic RFQ, edit a quote after opening comparison; stale selection is rejected/refreshed; no price chosen unseen |
| 9 | Show notification ownership, audit decisions, pagination, phone layout, keyboard skip/main focus and readable empty/error state |
| 10 | Explain queued password recovery and scheduler; use only a private lab mail log/sink if demonstrating recovery, never show token-bearing URLs/logs in shared screenshots |

Additional manual negative checks: buyer B cannot read buyer A's RFQ/photos; supplier
cannot access competitor quotes; non-admin cannot use admin APIs; invalid/withdrawn/expired-price selections fail;
cancel/choice confirmations retain keyboard context; forged/missing CSRF proof is rejected. Existing automated
tests cover these paths; this handoff does not claim they were manually retested.

Finish by showing the API/ERD/decisions/tests and honest limitations: no email verification/provider selected,
no public-host test/verified restore rehearsal/load guarantee and pending business decisions. The owner confirmed
both M5c development migrations are Ran. Keep any demo accounts, logs, contact events or screenshots synthetic
and out of the source archive.
