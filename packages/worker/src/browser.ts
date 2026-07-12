import { chromium, type BrowserContext, type Page } from 'playwright';

import { config } from './config.js';
import { log } from './logger.js';

let context: BrowserContext | null = null;

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const contextOptions = {
  locale: 'ko-KR',
  viewport: { width: 1280, height: 900 },
  userAgent: USER_AGENT,
};

/** A locked Chrome profile can make launch HANG instead of throwing; cap it. */
const LAUNCH_TIMEOUT_MS = 20000;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

/**
 * A SINGLE long-lived context, reused across jobs so the Instagram login session
 * and cookies persist. Preference order:
 *   1. The user's real Chrome profile (launchPersistentContext on userDataDir) —
 *      keeps them logged in. Requires Chrome to be CLOSED (the profile is locked
 *      while Chrome runs).
 *   2. Bundled chromium against that same profile if the Chrome channel is absent.
 *   3. An ephemeral browser (no saved session) as a last resort.
 */
async function launchContext(): Promise<BrowserContext> {
  if (config.userDataDir) {
    const args = config.profileDirectory ? [`--profile-directory=${config.profileDirectory}`] : [];
    for (const channel of [config.browserChannel, undefined]) {
      try {
        const ctx = await withTimeout(
          chromium.launchPersistentContext(config.userDataDir, {
            ...contextOptions,
            headless: config.headless,
            channel,
            args,
            timeout: LAUNCH_TIMEOUT_MS,
          }),
          LAUNCH_TIMEOUT_MS,
          'launchPersistentContext',
        );
        log('BROWSER MODE: persistent Chrome profile ✓ (Instagram login/cookies preserved)', {
          userDataDir: config.userDataDir,
          profile: config.profileDirectory,
          channel: channel ?? 'bundled',
        });
        return ctx;
      } catch (err) {
        log('could not open Chrome profile (is Chrome fully closed?)', err);
        if (!config.browserChannel) break; // already tried bundled; don't loop
      }
    }
    log(
      'BROWSER MODE: EPHEMERAL fallback ✗ (profile locked/unavailable — Instagram is NOT logged in)',
    );
  } else {
    log('BROWSER MODE: EPHEMERAL (WORKER_USE_PROFILE disabled — Instagram is NOT logged in)');
  }

  const browser = await chromium
    .launch({ headless: config.headless, channel: config.browserChannel })
    .catch(() => chromium.launch({ headless: config.headless }));
  return browser.newContext(contextOptions);
}

async function getContext(): Promise<BrowserContext> {
  if (!context) context = await launchContext();
  return context;
}

/** A new page in the SHARED context (so it carries the logged-in session/cookies). */
export async function newPage(): Promise<Page> {
  return (await getContext()).newPage();
}

export async function closeBrowser(): Promise<void> {
  await context?.close().catch(() => undefined);
  context = null;
}
