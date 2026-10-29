import { execFileSync, execSync, spawn, type ChildProcess } from 'node:child_process'
import path from 'node:path'
import { BACKEND_DIR, backendEnv, E2E_API_PORT, E2E_WEB_PORT } from './env.ts'

/*
 * Starts and stops the e2e servers ourselves instead of Playwright's `webServer`: on Windows that runs
 * commands through cmd.exe + Herd's php.bat, and teardown hung with both servers left running (M2b).
 * Here we spawn the real binaries without a shell and kill exactly those process trees.
 */

const env = { ...process.env, ...backendEnv }

const artisan = (args: string) => execSync(`php artisan ${args}`, { cwd: BACKEND_DIR, env, encoding: 'utf8' }).trim()

function stop(child: ChildProcess) {
  if (child.pid === undefined || child.exitCode !== null) return
  try {
    if (process.platform === 'win32') execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' })
    else child.kill('SIGTERM')
  } catch {
    // Already gone (e.g. its tree was killed together with the other server).
  }
}

async function waitFor(check: () => Promise<boolean>, what: string, children: ChildProcess[]) {
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    if (children.some((c) => c.exitCode !== null)) break
    if (await check().catch(() => false)) return
    await new Promise((r) => setTimeout(r, 500))
  }
  children.forEach(stop)
  throw new Error(`e2e: ${what} did not become ready`)
}

export default async function globalSetup() {
  // 1. Verify the resolved configuration AND live server before any migration, seed or cache write.
  const php = execSync('php -r "echo PHP_BINARY;"', { env, encoding: 'utf8' }).trim()
  try {
    // Native binary + argument array: no shell escaping or PsySH history writes during verification.
    execFileSync(php, ['-r', "require 'vendor/autoload.php'; $app = require 'bootstrap/app.php'; $app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap(); App\\Support\\TestDatabaseSafety::verifyServer();"], {
      cwd: BACKEND_DIR, env, stdio: 'pipe',
    })
  } catch {
    throw new Error('e2e: isolated test database verification failed. No preparation or tests started; connection details suppressed.')
  }
  process.stdout.write('e2e: effective configuration and live server verified against the isolated test target.\n')

  // 2. Non-destructive preparation: migrate + idempotent area seed; reset rate-limit counters
  //    (the cache table of warridli_test) so earlier runs can't trip the register/login limits.
  artisan('migrate --no-interaction')
  artisan('db:seed --class=AreaSeeder --no-interaction')
  artisan('db:seed --class=CategorySeeder --no-interaction')
  artisan('cache:clear --no-interaction')

  // 3. Servers. Laravel's router script treats the working directory as the public root.
  // The real php.exe behind Herd's php.bat wrapper, so killing it leaves no orphan.
  const api = spawn(
    php,
    ['-S', `127.0.0.1:${E2E_API_PORT}`, path.join(BACKEND_DIR, 'vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php')],
    { cwd: path.join(BACKEND_DIR, 'public'), env, stdio: 'ignore' },
  )
  const web = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(E2E_WEB_PORT), '--strictPort'], {
    env: { ...process.env, VITE_API_PROXY_TARGET: `http://127.0.0.1:${E2E_API_PORT}` },
    stdio: 'ignore',
  })
  const children = [api, web]

  // Ready = real JSON health answer through the proxy (a PHP warning page also returns 200).
  await waitFor(
    async () => {
      const res = await fetch(`http://localhost:${E2E_WEB_PORT}/api/health`)
      const body = (await res.json()) as { status?: string; database?: string }
      return res.ok && body.status === 'ok' && body.database === 'ok'
    },
    'Laravel + Vite',
    children,
  )

  return () => children.forEach(stop)
}
