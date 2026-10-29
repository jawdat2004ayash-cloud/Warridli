# Deployment readiness — reviewed procedure, not a deployment

M5d, 2026-10-28. No server/account/domain was created, no machine exposed, no production connection made.
Commands below belong to a **future explicitly approved release**, not the owner's existing checkout/database.
Resolve [release gates](RELEASE_READINESS.md), verify a [restorable backup](BACKUP_RESTORE.md), and rehearse
with synthetic data before public sharing. Do not use `artisan serve`, Vite dev/preview or a tunnel as public hosting.

## Requirements derived from this checkout

| Need | Actual evidence / requirement |
|---|---|
| PHP | root `composer.json` says ^8.3; locked Symfony 8.1 packages require **>=8.4.1**. Tested 8.5.12; run `composer check-platform-reqs --no-dev` on the deployment platform |
| Extensions | Laravel: ctype, curl, dom, fileinfo, filter, hash, mbstring, openssl, pcre, PDO, session, tokenizer, xml; this app additionally needs **pdo_mysql, GD JPEG/PNG/WebP**, EXIF for correct orientation. OPcache recommended; queue signals need pcntl where timeouts are used |
| Dependency tooling | Composer 2, exact `backend/composer.lock`; no `--ignore-platform-reqs`. Do not install development packages on the public runtime |
| Build tooling | Prefer tested Node 24.21.x / npm 11.19; locked tools require at least Node 24.15 in the 24.x line. `npm ci`, then `npm run build` in `frontend`; Node not required to serve the built SPA |
| Database | Maintained **MariaDB 11.4 LTS**, parity with tested 11.4.13; InnoDB, utf8mb4_unicode_ci, UTC storage. No production parity/load test has run |
| Durable state | Database plus persistent **private local photo storage**; secrets/key retained across releases |
| Process support | PHP-FPM/Apache handler; per-minute scheduler; existing database queue worker for reset emails; SMTP delivery; backups/log rotation |

CLI and web PHP must have the same compatible extensions/version/configuration. Local tests remain fixed to
`warridli_test` on loopback 3307; production uses **its own** endpoint/schema/account and never runs test preparation.
Laravel's general framework requirement is lower than this lockfile's effective requirement.
[Official Laravel deployment reference](https://laravel.com/framework/docs/13.x/deployment).
MariaDB lists 11.4 community maintenance through **29 May 2029**; check patch/security status again when
deploying, without upgrading this project during M5d. [MariaDB maintenance table](https://mariadb.org/about/).

## One browser origin is required

The browser must see **one HTTPS origin**, e.g. `https://demo.example.org`:

| Request | Destination |
|---|---|
| `/`, `/login`, `/rfqs/...`, `/supplier/...`, `/admin/...`, reset URLs | React `index.html` fallback |
| `/assets/...` and generated static public assets | built frontend files; missing assets must return 404 |
| `/api` and `/api/...` | Laravel `backend/public/index.php`, preserving method/body/query/headers |
| `/sanctum` and `/sanctum/...` | Laravel, including `/sanctum/csrf-cookie` |
| `/up` | Laravel liveness endpoint; `/api/health` also checks database access |

`frontend/src/lib/api.ts` uses relative `/api` and `/sanctum` paths with `credentials: 'same-origin'`.
There is **no VITE_API_URL setting** to point it at another public domain. `VITE_API_PROXY_TARGET` is only the
development Vite proxy target; a production build contains no Vite proxy. A static host plus unrelated API host
does not work as-is. Cross-origin cookies/CORS or an edge proxy would require separate design/security validation.
Do not replace this with tokens or relax CSRF to fit a free host.

No project CORS override is published; framework defaults do not enable credentialed cross-origin SPA auth.
Same-origin hosting needs no permissive CORS change. Do not add `*` with credentialed requests. Preserve Origin,
Host, forwarded scheme and cookies through any reviewed proxy; trust only the actual proxy IPs/networks.
`bootstrap/app.php` currently has no custom trusted-proxy configuration; assess TLS termination before activation.
[Sanctum SPA authentication](https://laravel.com/docs/13.x/sanctum#spa-authentication).

## Release files and public root

Keep source/releases and shared private data outside publicly served directories. Example operator layout:
`/srv/warridli/releases/<commit>/{backend,frontend/dist}`, `/srv/warridli/shared/private`, and a managed `current`
release pointer. Do not make the repository root, backend root, `.env`, vendor or storage web-accessible.
Laravel's **only PHP entry point is `backend/public/index.php`**. Frontend build output is the other public asset root.

Two alternatives require server-side configuration; neither was installed/tested here:

### Nginx + PHP-FPM example

Use a reviewed TLS server, provider certificate and actual PHP-FPM socket. This is a template to syntax-check with
`nginx -t` before use, not a ready-made host configuration. Add the host's correct MIME include, TLS settings,
HTTP→HTTPS redirect and certificate renewal. Avoid CDNs caching API/photo/CSRF/session responses.

```nginx
server {
    listen 443 ssl;
    server_name demo.example.org;
    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;
    root /srv/warridli/current/frontend/dist;
    index index.html;
    client_max_body_size 32m;

    # Fixed entry point: never execute a request-supplied PHP filename.
    location ~ ^/(api(?:/|$)|sanctum(?:/|$)|up$) {
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME /srv/warridli/current/backend/public/index.php;
        fastcgi_param DOCUMENT_ROOT /srv/warridli/current/backend/public;
        fastcgi_param SCRIPT_NAME /index.php;
        fastcgi_param HTTP_HOST $host;
        fastcgi_param HTTPS on;
        fastcgi_pass unix:/run/php/php8.5-fpm.sock;
    }
    location ~ /\. { deny all; }
    location ~ \.php(?:/|$) { return 404; }
    location /assets/ {
        try_files $uri =404;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
    location = /index.html {
        add_header Cache-Control "no-cache";
    }
    location / { try_files $uri $uri/ /index.html; }
}
```

Provider-managed HTTP challenge handling may need a narrowly scoped `/.well-known/acme-challenge/` exception.
When TLS terminates upstream rather than in this block, replace assumptions with the provider's verified proxy
configuration; do not blindly trust all forwarded headers. Keep hashed assets from the previous compatible
release for already-open tabs; switch HTML atomically and never cache HTML as immutable. M5c includes a generic
retry if a route chunk is unavailable.

### Apache / shared-host alternative

Point the site's document root to **backend/public**. In a deployment artifact (not the source checkout), place
the built React `index.html`, `assets/` and required public static assets there. Preserve `index.php`; do not copy
node_modules, source, `.vite` metadata, or overwrite Laravel's `.htaccess` blindly.
The current Laravel `.htaccess` sends unknown paths to PHP and **does not provide a React history fallback**.
Configure DirectoryIndex `index.html` and reviewed rewrite rules in this order:

1. Keep Laravel's Authorization and X-XSRF-Token forwarding and disable directory listings/MultiViews.
2. Route `^(api(?:/|$)|sanctum(?:/|$)|up$)` to `index.php` **before** static/SPA fallbacks.
3. Deny dotfiles and arbitrary PHP execution (only the fixed index entry is needed).
4. Serve existing static files; missing `/assets/...` must 404, not return HTML.
5. Other frontend paths fall back to `index.html`; preserve query strings and multipart bodies.

Validate Apache configuration/AllowOverride behavior and actual HTTPS/CSRF/routing with synthetic data before
sharing. Do not place the entire backend under an unrestricted `htdocs` or use broad rewrite rules as a substitute
for protecting non-public files. A host that cannot configure these routes/root is not yet compatible.

## Production environment — set privately

The following are non-secret settings to configure in the future provider environment. Supply **unique** production
DB/mail credentials and APP_KEY through a private secret store; never copy development `.env` or cached config.
Generate APP_KEY once for a **new** installation, never on an existing/restored installation. Recover its original
key securely when restoring. Do not put any secret in `VITE_*` variables; those may be bundled for the browser.

```dotenv
APP_ENV=production
APP_DEBUG=false
APP_URL=https://demo.example.org
FRONTEND_URL=https://demo.example.org
APP_LOCALE=ar
APP_FALLBACK_LOCALE=en
SANCTUM_STATEFUL_DOMAINS=demo.example.org
SESSION_DRIVER=database
SESSION_SECURE_COOKIE=true
SESSION_HTTP_ONLY=true
SESSION_SAME_SITE=lax
SESSION_DOMAIN=null
SESSION_PATH=/
CACHE_STORE=database
QUEUE_CONNECTION=database
FILESYSTEM_DISK=local
PRIVATE_STORAGE_ROOT=/srv/warridli/shared/private
LOG_CHANNEL=stack
LOG_STACK=daily
LOG_LEVEL=warning
```

Use actual hostnames **without scheme** in SANCTUM_STATEFUL_DOMAINS, adding non-default ports if used.
Set DB_CONNECTION `mariadb`, the actual production DB_HOST/PORT/DATABASE and scoped credentials; no read/write
split, socket or DB_URL unless deliberately reviewed. Use a private DB network or verified TLS/CA for remote DB
traffic; `MYSQL_ATTR_SSL_CA` is the currently supported PDO CA setting. Do not expose MariaDB publicly.
Configure tested SMTP/from-address values rather than `MAIL_MAILER=log` for real recovery. Logs must not become a
public reset-link delivery mechanism. Validate cookie flags, CSRF rejection and effective URLs after config caching.

`SESSION_DOMAIN=null` keeps a host-only cookie for the recommended single host. Do not set a broad parent domain
unless a separately reviewed deployment needs it. Configure secure cookies only on HTTPS; keep local examples HTTP.

## Build and activation sequence — future approval required

1. Create an isolated release from the approved commit, matching engine/runtime, private credentials and empty
   new schema (or a verified existing deployment with a completed backup/rehearsal). Protect write access while
   migrating. Existing owner `warridli` is **not authorized** by this document.
2. On a build machine/new release, `composer install --no-dev --prefer-dist --no-interaction --optimize-autoloader`
   in backend and `npm ci` then `npm run build` in frontend. Install from lockfiles; no `composer setup`, Boost,
   updates, frontend tooling from `backend/package.json`, or `--ignore-platform-reqs`. Build tools must be available
   before any npm production-dependency pruning. Keep generated artifacts out of the source submission.
3. Confirm web/CLI PHP with `composer check-platform-reqs --no-dev`, GD formats, fileinfo, EXIF and writable
   storage paths. Grant the web/process account write access only to required `backend/storage`,
   `backend/bootstrap/cache` and private upload root; code read-only, `.env` tightly restricted, **no chmod 777**.
4. Upload settings: PHP `upload_max_filesize >= 6M`, `post_max_size >= 32M`, web/proxy body limit >=32 MB;
   validate memory >=128 MB with real accepted images on staging. Browser resize is not a server safety guarantee.
   The app still enforces 5 photos, 5 MB each and 16 MP. Ensure persistent storage survives release/restart.
5. After backup verification + exact pending-list/SQL review + approval, run `php artisan migrate --force`
   against the confirmed deployment target. On a **new empty** demo schema only, run `php artisan db:seed --force`
   for reference data, then create a unique admin via its hidden prompt. Never import development users/photos.
   Existing production categories are data; do not reseed/overwrite them as a deploy habit.
6. Build configuration caches **within that configured release**, e.g. `php artisan config:cache`,
   `php artisan route:cache`, `php artisan view:cache`; stop on any failure and keep the old release active.
   Test caches on staging; do not ship developer cache files. These commands are not run by M5d.
7. Activate a coherent HTML/API/artifact release, reload PHP-FPM/OPcache as required, and restart the existing
   queue worker so it reads new code. Verify `/up`, `/api/health`, a deep SPA route, missing asset 404 and private
   path denial. A full role/CSRF/upload/recovery check still requires final acceptance approval.

## Scheduler, queue, files and logs

- Run `php /absolute/backend/artisan schedule:run` every minute under the application account and correct release
  environment. `routes/console.php` expires RFQs every 15 minutes with `withoutOverlapping()` using the database
  cache lock. Do not add a public HTTP scheduler endpoint. Use `schedule:work` only for local demonstration.
- D39 in-app notifications are **synchronous database writes inside transactions**; no new worker/queue needed
  for them. Password-reset mail is already `ShouldQueue` for timing privacy and requires processing of `jobs`.
- Preferred full hosting: supervise the existing `php artisan queue:work --tries=3 --timeout=30` worker; verify
  SMTP timeouts and PCNTL support, and keep worker timeout below database queue `retry_after` (default 90 seconds).
  Restart it on releases; monitor failed jobs without displaying payloads/tokens.
- A limited free host may allow a per-minute **short-lived** `php artisan queue:work --stop-when-empty
  --max-time=50 --timeout=30 --tries=3 --memory=128` scheduled command instead. This retains asynchronous D5 mail;
  do not switch QUEUE_CONNECTION to sync to hide a hosting limitation. Actual cron permissions, PHP timeout
  support, latency, CPU/RAM and email delivery need rehearsal. `--max-time` is checked between jobs, not a hard
  OS wall-clock limit. This is a deployment candidate, not a change made to project configuration.
- RFQ photos explicitly use the **local** disk. Merely selecting S3 as FILESYSTEM_DISK does not migrate them.
  Preserve `PRIVATE_STORAGE_ROOT`; no `storage:link` is needed for private photos, and never expose that root or
  cache it publicly. Moving to object storage needs separately approved code/testing.
- Rotate/restrict application, PHP, scheduler and queue logs; avoid logging sensitive URL queries (reset tokens),
  request bodies/cookies or environment values. Decide retention and monitor disk/quota/database/worker failures.
  Health errors must stay generic; APP_DEBUG=false. Maintain off-device encrypted backups and rehearse recovery.

## Rollback and public-readiness limits

Keep the prior source/production artifacts and shared data references; stop writes/workers before a failed
activation. An app release rollback is safe only when that app is compatible with the current schema. M5c's index
can usually remain on older code, but do not assume older timestamp writers preserve microsecond versions.
MariaDB DDL can commit partially; inspect schema/migration records if an ALTER fails, keep traffic paused and
get review. Never run automatic `migrate:rollback`, `migrate:reset`, `migrate:fresh`, DROP/TRUNCATE or a restore
over a live schema. Timestamp downgrade is lossy. Restoring an approved earlier SQL+photo pair discards intervening
writes and needs separate approval, a preserved current state, and a review of queued mail/sessions/key recovery.

No provider's web config, TLS, SMTP, cron, worker or resource limits were exercised by M5d. The free-host assessment
and remaining final-test steps are in [release readiness](RELEASE_READINESS.md).
