import path from 'node:path'

export const E2E_WEB_PORT = 5174
export const E2E_API_PORT = 8020
export const BACKEND_DIR = path.resolve(import.meta.dirname, '../../backend')

/**
 * Overrides for Laravel during e2e. Real environment variables win over backend/.env (immutable dotenv),
 * so credentials still come from .env, while the complete isolated database target is pinned.
 */
export const backendEnv: Record<string, string> = {
  APP_ENV: 'e2e',
  APP_DEBUG: 'false',
  DB_CONNECTION: 'mariadb',
  DB_HOST: '127.0.0.1',
  DB_PORT: '3307',
  DB_DATABASE: 'warridli_test',
  DB_URL: '',
  SANCTUM_STATEFUL_DOMAINS: `localhost:${E2E_WEB_PORT}`,
  SESSION_DRIVER: 'database',
  CACHE_STORE: 'database',
  QUEUE_CONNECTION: 'sync',
  MAIL_MAILER: 'array', // no reset links written anywhere
  PRIVATE_STORAGE_ROOT: path.join(BACKEND_DIR, 'storage', 'app', 'e2e-private'), // RFQ photos (git-ignored)
}
