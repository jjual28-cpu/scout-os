import { closeBrowser, newPage } from './browser.js';
import { config } from './config.js';
import { log } from './logger.js';
import { getProvider } from './providers/registry.js';
import { claimNextJob, completeJob, failJob, upsertCreators } from './supabase.js';
import { BlockedError, type DiscoveryJob, type SearchContext } from './types.js';

let stopping = false;

/** Run a single claimed job end to end. */
async function processJob(job: DiscoveryJob): Promise<void> {
  log(`job ${job.id} claimed`, { platform: job.platform, query: job.query, attempt: job.attempts });

  const provider = getProvider(job.platform);
  if (!provider) {
    await failJob(job, `no_provider_for_platform:${job.platform}`);
    log(`job ${job.id} failed — no provider for "${job.platform}"`);
    return;
  }

  const ctx: SearchContext = {
    newPage,
    limit: config.resultLimit,
    log: (m) => log(`  [${job.id}] ${m}`),
  };

  try {
    const creators = await provider.search(job.query, ctx);
    await upsertCreators(job.user_id, creators);
    await completeJob(job.id, creators.length);
    log(`job ${job.id} succeeded — ${creators.length} creators`);
  } catch (err) {
    // Blocked (login/captcha) → record the cause, never bypass.
    const reason =
      err instanceof BlockedError
        ? `blocked:${err.reason}`
        : err instanceof Error
          ? err.message
          : 'unknown_error';
    await failJob(job, reason);
    log(`job ${job.id} failed — ${reason}`);
  }
}

/** Poll for pending jobs until stopped. */
export async function runLoop(): Promise<void> {
  log('worker started', {
    poll: `${config.pollIntervalMs}ms`,
    limit: config.resultLimit,
    headless: config.headless,
    channel: config.browserChannel ?? 'bundled-chromium',
  });

  while (!stopping) {
    let job: DiscoveryJob | null = null;
    try {
      job = await claimNextJob();
    } catch (err) {
      log('failed to poll jobs', err);
    }

    if (job) {
      await processJob(job);
      continue; // immediately look for the next job
    }

    await sleep(config.pollIntervalMs);
  }

  await closeBrowser();
  log('worker stopped');
}

export function requestStop(): void {
  if (!stopping) {
    stopping = true;
    log('stop requested — finishing current job then exiting');
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    if (typeof t === 'object' && 'unref' in t) t.unref();
  });
}
