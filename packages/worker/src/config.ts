import 'dotenv/config';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name} (see packages/worker/.env.example)`);
  return v;
}

function int(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function bool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v == null || v === '') return fallback;
  return v === 'true' || v === '1';
}

function str(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v || undefined;
}

/**
 * Dedicated Scout worker Chrome user-data-dir — a SEPARATE profile store from the
 * user's everyday Chrome, so the two never collide (no profile-lock conflict).
 * Playwright auto-creates it on first launch; log in to Instagram once there and
 * the session/cookies persist across runs.
 */
const defaultUserDataDir =
  process.platform === 'win32' && process.env.LOCALAPPDATA
    ? `${process.env.LOCALAPPDATA}\\ScoutWorker\\chrome-profile`
    : process.env.HOME
      ? `${process.env.HOME}/.scout-worker/chrome-profile`
      : undefined;

// Use the dedicated Scout Chrome profile by default so Instagram stays logged in
// (session + cookies persist) without touching the user's own Chrome. Set
// WORKER_USE_PROFILE=false to run an ephemeral browser instead.
const useProfile = bool('WORKER_USE_PROFILE', true);

export const config = {
  supabaseUrl: required('SUPABASE_URL'),
  serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  pollIntervalMs: int('WORKER_POLL_INTERVAL_MS', 5000),
  resultLimit: int('WORKER_RESULT_LIMIT', 20),
  maxAttempts: int('WORKER_MAX_ATTEMPTS', 3),
  headless: bool('WORKER_HEADLESS', false),
  // Empty string ⇒ use Playwright's bundled chromium instead of installed Chrome.
  browserChannel: (process.env.WORKER_BROWSER_CHANNEL ?? 'chrome').trim() || undefined,

  // Dedicated Scout Chrome profile (keeps the Instagram login session between runs).
  //  - useProfile=false ⇒ ephemeral browser (no saved session).
  //  - userDataDir: dedicated Scout user-data-dir (NOT the user's real Chrome).
  //  - profileDirectory: which profile inside it (default "Default").
  useProfile,
  userDataDir: useProfile ? (str('WORKER_USER_DATA_DIR') ?? defaultUserDataDir) : undefined,
  profileDirectory: str('WORKER_CHROME_PROFILE') ?? 'Default',
} as const;
