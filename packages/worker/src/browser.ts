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
        log('opening Chrome profile', {
          userDataDir: config.userDataDir,
          channel: channel ?? 'bundled',
        });
        return await chromium.launchPersistentContext(config.userDataDir, {
          ...contextOptions,
          headless: config.headless,
          channel,
          args,
        });
      } catch (err) {
        log('could not open Chrome profile (is Chrome fully closed?)', err);
        if (!config.browserChannel) break; // already tried bundled; don't loop
      }
    }
    log('falling back to an ephemeral browser — Instagram will not be logged in');
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
