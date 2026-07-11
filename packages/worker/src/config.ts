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

/** Windows default Chrome "User Data" root (holds the login/cookie profiles). */
const defaultChromeUserDataDir =
  process.platform === 'win32' && process.env.LOCALAPPDATA
    ? `${process.env.LOCALAPPDATA}\\Google\\Chrome\\User Data`
    : undefined;

// Use the user's real Chrome profile by default so Instagram stays logged in
// (session + cookies persist). Set WORKER_USE_PROFILE=false to run an ephemeral
// browser instead.
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

  // Persistent Chrome profile (keeps the Instagram login session between runs).
  //  - useProfile=false ⇒ ephemeral browser (no saved session).
  //  - userDataDir: the "User Data" ROOT; defaults to the OS Chrome location.
  //  - profileDirectory: which profile inside it (e.g. "Default", "Profile 1").
  useProfile,
  userDataDir: useProfile ? (str('WORKER_USER_DATA_DIR') ?? defaultChromeUserDataDir) : undefined,
  profileDirectory: str('WORKER_CHROME_PROFILE') ?? 'Default',
} as const;
