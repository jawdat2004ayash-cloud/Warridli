# Backup and restore runbook

Prepared in M5d, 2026-10-28. **Documentation, not an executed backup or restore.** No verified backup currently
exists as a result of this milestone. An actual isolated restore rehearsal and explicit owner approval are
required before applying the pending M5c migrations to development.

## Targets and boundaries

| Target | Purpose | Permitted operation in this milestone |
|---|---|---|
| `warridli`, loopback 3307 | Owner's existing development data | No migration/restore/reset; procedures below are for later approved operation |
| `warridli_test`, loopback 3307 | Disposable automated tests, MariaDB 11.4.x | Writes only after the live test preflight; never a backup destination |
| `warridli_restore_test` | **New empty** restore rehearsal schema, provisioned later | No creation/import performed; never point Pest/e2e at it |
| Future production, separately named/accounted | Public demo or real service | Not provisioned; independent credentials, backup location and approval |

Never use XAMPP's port 3306 or its `test`, `we_login_system`, `phpmyadmin` schemas for these local procedures.
Provider production ports may legitimately differ; that does not relax the fixed local automated-test guard.

A backup set contains: database SQL, **private photo files**, their hashes, capture time/UTC, source server/schema
identity, engine/client versions, commit SHA, applied migration names, exact per-table counts and schema metadata.
Keep the matching APP_KEY and environment configuration in a **separately encrypted secret recovery record**.
Do not print/copy secrets into a manifest, README, Git, email, transcript or source ZIP. SQL contains passwords
(hashes), contact details, sessions, reset tokens and queued messages: it is sensitive even without plaintext passwords.

## Before taking a backup

1. Obtain permission for the source and a private, encrypted backup destination **outside the checkout/web root**.
   Restrict access to the owner/operator. Agree on retention and recovery objectives; daily copies and an off-device
   copy are a proposed starting point, not an implemented policy or an RPO/RTO guarantee.
2. Install/use matching maintained MariaDB **11.4 client tools** from a trusted source if missing. M5d found no
   `mariadb` / `mariadb-dump` on PATH and installed nothing. Do not silently use XAMPP's older binaries.
   Verify full executable paths and `--version`. New dumps can contain a sandbox command older/MySQL clients
   cannot read; use the matching MariaDB client. [MariaDB dump reference](https://mariadb.com/docs/server/clients-and-utilities/backup-restore-and-import-clients/mariadb-dump).
3. Coordinate a quiet window: prevent application writes/uploads and stop the scheduler and mail workers;
   also account for any other DB clients. `--single-transaction` gives an InnoDB snapshot, **not** a snapshot
   of photos, and concurrent DDL invalidates that guarantee. Do not alter/create/drop/rename/truncate tables
   while dumping. [MariaDB consistency rules](https://mariadb.com/docs/server/clients-and-utilities/backup-restore-and-import-clients/mariadb-dump#--single-transaction).
4. Privately verify the effective Laravel connection (including DB_URL, socket, cached config and overrides)
   matches the source. Use a native read-only client to verify `DATABASE(), @@port, VERSION()` and table engines.
   Record exact `COUNT(*)` for **every table**, not approximate information_schema row estimates.
5. Inventory views, routines, triggers and events with a DBA-visible metadata account. Current migrations create
   ordinary tables and none of those programmable objects. If any exist, have a DBA review definers, qualified
   schema references and restore side effects before continuing. Do not blindly rewrite SQL with string replacement.

## Windows PowerShell backup — operator-run later

This block only **reads** the named source; it writes new backup files to the chosen private directory.
Use an authorized backup account with sufficient SELECT/metadata privileges for the dump options; do not grant
global privileges just to make a dump succeed. Passwords are entered at native hidden prompts, never arguments.
Stop on a nonzero exit: a partial output file is not a backup. Do not run these instructions as part of M5d verification.

```powershell
$mariaClient = (Resolve-Path -LiteralPath (Read-Host 'Full path to matching mariadb.exe')).Path
$mariaDump = (Resolve-Path -LiteralPath (Read-Host 'Full path to matching mariadb-dump.exe')).Path
$backupDir = (Resolve-Path -LiteralPath (Read-Host 'Existing PRIVATE backup directory outside the project')).Path
$backupUser = Read-Host 'Authorized backup username'
$sourceSchema = 'warridli' # DEV source only. A different installation needs its own reviewed identity gate.
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$dumpPath = Join-Path $backupDir "warridli-$stamp.sql"
if (Test-Path -LiteralPath $dumpPath) { throw 'Refusing to overwrite a backup.' }
$readArgs = @('--no-defaults','--protocol=TCP','--host=127.0.0.1','--port=3307',
    "--user=$backupUser",'--password',"--database=$sourceSchema",'--batch','--skip-column-names')
$identity = & $mariaClient @readArgs '--execute=SELECT CONCAT(DATABASE(),CHAR(124),@@port,CHAR(124),VERSION());'
if ($LASTEXITCODE -ne 0 -or $identity -notmatch '^warridli\|3307\|11\.4\..*MariaDB') {
    throw 'Unexpected source; no dump started.'
}
$dumpArgs = @('--no-defaults','--protocol=TCP','--host=127.0.0.1','--port=3307',
    "--user=$backupUser",'--password','--default-character-set=utf8mb4',
    '--single-transaction','--quick','--hex-blob','--tz-utc',
    '--routines','--events','--triggers','--no-create-db','--skip-add-drop-table','--skip-add-locks',
    "--result-file=$dumpPath",$sourceSchema)
& $mariaDump @dumpArgs
if ($LASTEXITCODE -ne 0 -or (Get-Item -LiteralPath $dumpPath).Length -eq 0) {
    throw 'Incomplete backup: quarantine it and investigate; do not migrate.'
}
$digest = (Get-FileHash -LiteralPath $dumpPath -Algorithm SHA256).Hash
[System.IO.File]::WriteAllText("$dumpPath.sha256", $digest)
```

Use **one positional schema**, not `--databases` / `--all-databases`: the latter can introduce CREATE DATABASE /
USE statements that defeat a restore destination. The omitted DROP TABLE statements make an accidental import
over existing tables fail earlier; they do **not** make imports safe without the isolation/account gates below.
`--result-file` avoids PowerShell text redirection/encoding conversion. It can overwrite existing files, hence
the explicit path-existence guard. [Windows output option](https://mariadb.com/docs/server/clients-and-utilities/backup-restore-and-import-clients/mariadb-dump#-r---result-filefile).

While the same quiet window remains in effect, archive the **effective** local disk root from
`config/filesystems.php` (`backend/storage/app/private` by default; PRIVATE_STORAGE_ROOT may override it).
Do not substitute `storage/app/public` or the e2e photo directory.

```powershell
$privateRoot = (Resolve-Path -LiteralPath (Read-Host 'Effective private-photo root')).Path
$photosPath = Join-Path $backupDir "private-photos-$stamp.tar"
if (Test-Path -LiteralPath $photosPath) { throw 'Refusing to overwrite an archive.' }
tar.exe -cf $photosPath -C $privateRoot .
if ($LASTEXITCODE -ne 0) { throw 'Photo backup failed; backup set incomplete.' }
[System.IO.File]::WriteAllText("$photosPath.sha256", (Get-FileHash -LiteralPath $photosPath -Algorithm SHA256).Hash)
```

Use the OS tar tool or an approved archiver; none was installed or invoked in M5d. Save a private per-file
relative-path/size/SHA-256 manifest before releasing the quiet window. Include all files; do not archive logs,
vendor/node_modules or the full developer home directory. Save migration metadata separately; SQL and photos
must describe the same point in time. Record completion/failures, encrypt/protect the set, and verify hashes after
copying it off-device. A matching hash proves byte integrity, **not** logical consistency or restorability.

Linux uses the same dump options with `mariadb-dump ... --result-file=/private/new-file.sql warridli` and
`tar -cf /private/new-photos.tar -C /effective/private/root .`; validate nonexistence and command exit codes,
use password prompts or protected option files, `sha256sum` and restrictive file permissions. On remote production,
use that deployment's reviewed endpoint, schema and verified TLS/private network; do not copy the local 3307 gate.

## Restore rehearsal — new empty target, separately approved

This is a **database-writing operation** and was not performed in M5d. It is not a Pest/Playwright run.

1. Get explicit approval. Prefer an isolated MariaDB 11.4 server with no application/network exposure and its
   event scheduler off. If a DBA approves a same-server namespace rehearsal, first confirm no programmable
   objects in the source/dump. The DBA creates empty `warridli_restore_test` with utf8mb4 and a **different user
   scoped ONLY to this schema**, with no access to `warridli`, `warridli_test`, other schemas or global privileges.
   Never reuse the application/backup user for restoring. Do not create/overwrite an existing target.
2. Disable application entry points, outbound mail, scheduler and workers for the restore copy. Imported `jobs`
   and reset tokens must never trigger messages. Do not connect the live application or automated tests to it.
3. Verify the trusted SQL/photo hashes against their private manifests. Review the SQL for CREATE DATABASE,
   USE, qualified source-schema references, destructive statements, definer/programmable objects and executable
   comments. Never inspect a data dump in chat. The account restriction is the primary protection, not a regex scan.
4. Run the following in a fresh PowerShell terminal with the matching client. Use a reviewed SQL path without
   spaces, quotes, backslashes or semicolons (for example `C:/PrivateBackupReview/database.sql`); this is a client
   SOURCE command, **not a PowerShell text pipe**. Keep that temporary review copy private/encrypted too.

```powershell
$mariaClient = (Resolve-Path -LiteralPath (Read-Host 'Full path to matching mariadb.exe')).Path
$restoreUser = Read-Host 'RESTORE-ONLY username, restricted to the empty lab schema'
$restoreSchema = 'warridli_restore_test'
$sqlPath = Read-Host 'Reviewed SQL path using forward slashes, no spaces/quotes/semicolon'
if ($sqlPath -notmatch '^[A-Za-z]:/[A-Za-z0-9_./-]+\.sql$' -or !(Test-Path -LiteralPath $sqlPath)) {
    throw 'Unsafe/missing SQL path.'
}
$restoreArgs = @('--no-defaults','--protocol=TCP','--host=127.0.0.1','--port=3307',
    "--user=$restoreUser",'--password',"--database=$restoreSchema",'--batch','--skip-column-names')
$identity = & $mariaClient @restoreArgs '--execute=SELECT CONCAT(DATABASE(),CHAR(124),@@port,CHAR(124),VERSION());'
if ($LASTEXITCODE -ne 0 -or $identity -notmatch '^warridli_restore_test\|3307\|11\.4\..*MariaDB') {
    throw 'Unexpected restore target.'
}
$tables = & $mariaClient @restoreArgs '--execute=SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE();'
if ($LASTEXITCODE -ne 0 -or "$tables".Trim() -ne '0') { throw 'Target is not verified empty.' }
& $mariaClient @restoreArgs "--execute=SOURCE $sqlPath"
if ($LASTEXITCODE -ne 0) { throw 'Restore failed. Keep it isolated; do not retry over the partial import.' }
```

For a different isolated lab port, change and review **both** explicit connection and live-port assertion;
never weaken the schema gate. No `--force`, no dropping/recreating a failed target: provision a new approved
empty lab target and revise the explicit allow-list instead. Record the failure; do not touch development.

5. Restore photos to a **new empty private lab directory**, never the development directory or a public web
   folder. List tar entries first; reject absolute paths, `..` traversal and links. Extract only a trusted own
   archive with `tar.exe -xf <reviewed-archive> -C <empty-private-lab-directory>`. Compare every file against
   the private per-file manifest. Do not execute anything from an archive.

## Verify before calling the backup usable

- Compare database/table lists, exact **all-table** row counts, indexes, FKs, collation, migration records and
  timestamp precision against the captured manifest. Verify utf8mb4 Arabic content locally without exporting it.
- `CHECK TABLE` on restored tables may detect engine corruption; it **does not** prove FK consistency. MariaDB
  dumps can disable FK checks temporarily. Explicitly check every FK for orphan rows and selected-quote ownership.
  Examples below return only counts; zero is expected. Extend to all FKs from information_schema.

  ```sql
  SELECT COUNT(*) AS wrong_selected_quote FROM rfqs r
    LEFT JOIN quotes q ON q.id=r.selected_quote_id
    WHERE r.selected_quote_id IS NOT NULL AND (q.id IS NULL OR q.rfq_id<>r.id);
  SELECT COUNT(*) AS orphan_quote FROM quotes q
    LEFT JOIN rfqs r ON r.id=q.rfq_id LEFT JOIN companies c ON c.id=q.supplier_company_id
    WHERE r.id IS NULL OR c.id IS NULL;
  SELECT COUNT(*) AS orphan_photo FROM rfq_attachments a LEFT JOIN rfqs r ON r.id=a.rfq_id WHERE r.id IS NULL;
  ```

- Privately map every `rfq_attachments.path` to an existing file under the restored private root and compare
  size/hash; verify no traversal. Record any missing/orphan files for review rather than deleting them.
- Record dump/photo hash verification, import exit codes, schema/count/integrity results, operator, versions,
  elapsed restore time and any limitations. Only a completed rehearsal makes this a **verified backup**.
- A later explicitly approved synthetic application check may validate private-photo authorization with a
  separate lab configuration. Never run writing tests against restored personal data or bypass TestDatabaseSafety.
- Before recovery into any real installation, get separate approval, preserve its current state and review jobs,
  sessions, keys, downtime/data-loss window and storage pairing. A production restore is not this rehearsal.

## Before any schema migration

Use the [M5c gate](RELEASE_READINESS.md#m5c-migration-gate): freeze writes, complete SQL+photo backup,
verify an isolated restore, inspect pretend SQL and current schema, get explicit approval, then run only the
reviewed pending migrations. Keep the previous application release and compatible artifacts. MariaDB DDL
is not a cross-statement transaction; an index may succeed while a later ALTER fails. Inspect and stop rather
than forcing a rollback/reset. Precision downgrade discards quote versions. No such command ran in M5d.
