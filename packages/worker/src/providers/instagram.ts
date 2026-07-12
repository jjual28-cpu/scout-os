import type { Locator, Page } from 'playwright';

import {
  BlockedError,
  type NormalizedCreator,
  type SearchContext,
  type SearchProvider,
} from '../types.js';

/** IG path segments that are not usernames. */
const RESERVED = new Set([
  'p',
  'reel',
  'reels',
  'explore',
  'stories',
  'tv',
  'accounts',
  'about',
  'developer',
  'legal',
  'directory',
  'web',
  'api',
  'graphql',
  'privacy',
  'terms',
  'blog',
  'press',
  'ads',
  'help',
  'direct',
  'emails',
  'session',
  'challenge',
]);

function usernameFromUrl(href: string): string | null {
  try {
    const u = new URL(href, 'https://www.instagram.com');
    if (!/(^|\.)instagram\.com$/.test(u.hostname)) return null;
    const seg = u.pathname.split('/').filter(Boolean)[0];
    if (!seg) return null;
    const username = seg.toLowerCase();
    if (RESERVED.has(username)) return null;
    if (!/^[a-z0-9._]{1,30}$/.test(username)) return null;
    return username;
  } catch {
    return null;
  }
}

/** Parse "1,234 Followers, 567 Following, 89 Posts" (any locale digits with separators). */
function parseCounts(desc: string | null): {
  followers: number | null;
  following: number | null;
  posts: number | null;
} {
  const empty = { followers: null, following: null, posts: null };
  if (!desc) return empty;
  const num = (label: RegExp): number | null => {
    const m = desc.match(label);
    const raw = m?.[1];
    if (!raw) return null;
    const n = Number(raw.replace(/[.,\s]/g, ''));
    return Number.isFinite(n) ? n : null;
  };
  return {
    followers: num(/([\d.,]+)\s*(?:Followers|팔로워)/i),
    following: num(/([\d.,]+)\s*(?:Following|팔로잉)/i),
    posts: num(/([\d.,]+)\s*(?:Posts|게시물)/i),
  };
}

async function metaContent(page: Page, selector: string): Promise<string | null> {
  try {
    return await page.locator(selector).first().getAttribute('content', { timeout: 3000 });
  } catch {
    return null;
  }
}

function instagramLoginWalled(url: string, bodyText: string): boolean {
  if (url.includes('/accounts/login')) return true;
  const t = bodyText.toLowerCase();
  return (
    (t.includes('log in') || t.includes('로그인')) &&
    (t.includes('password') || t.includes('비밀번호')) &&
    bodyText.length < 4000 // login-wall pages are small; real content pages are large
  );
}

/** All username-shaped account links currently on the page. */
async function accountHrefs(page: Page): Promise<string[]> {
  const hrefs = await page.$$eval('a[href^="/"]', (els) =>
    els.map((e) => e.getAttribute('href') ?? '').filter(Boolean),
  );
  return hrefs;
}

/** Locate Instagram's search input, opening the search flyout from the nav if needed. */
async function findSearchInput(page: Page): Promise<Locator | null> {
  const direct = page.getByPlaceholder(/검색|Search/i).first();
  if (await direct.isVisible({ timeout: 3000 }).catch(() => false)) return direct;

  // Search may live behind a nav item — open it, then look again.
  const nav = page.getByRole('link', { name: /검색|Search/i }).first();
  if (await nav.isVisible({ timeout: 2000 }).catch(() => false)) {
    await nav.click().catch(() => undefined);
    await page.waitForTimeout(1200);
    const input = page.getByPlaceholder(/검색|Search/i).first();
    if (await input.isVisible({ timeout: 3000 }).catch(() => false)) return input;
  }
  return null;
}

/**
 * PRIMARY: Instagram's own web search, driven through the real search UI.
 *
 * Returns the account usernames the search surfaced. Throws `BlockedError` only
 * when Instagram genuinely can't be searched — a login wall or a missing/unusable
 * search box — which is the ONLY thing that lets the caller fall back to Google.
 * A search that runs but finds nothing returns `[]` (no Google fallback).
 */
async function searchViaInstagram(query: string, ctx: SearchContext): Promise<string[]> {
  const page = await ctx.newPage();
  try {
    await page.goto('https://www.instagram.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(2000);

    const url = page.url();
    const body = (await page.textContent('body').catch(() => '')) ?? '';
    if (instagramLoginWalled(url, body)) throw new BlockedError('instagram_login_required');

    const input = await findSearchInput(page);
    if (!input) throw new BlockedError('instagram_search_unavailable');

    // Baseline the static links (nav, sidebar, suggestions) BEFORE typing so we
    // can isolate the links the search results add.
    const before = new Set(await accountHrefs(page));

    await input.click().catch(() => undefined);
    await input.fill(query.replace(/^#/, ''));
    await page.waitForTimeout(2800); // let the results dropdown populate

    const after = await accountHrefs(page);
    const fresh = after.filter((h) => !before.has(h));

    const usernames = [...new Set(fresh.map(usernameFromUrl).filter((u): u is string => !!u))];
    return usernames.slice(0, ctx.limit);
  } finally {
    await page.close().catch(() => undefined);
  }
}

/** LAST-RESORT FALLBACK: Google `site:instagram.com <query>` → profile usernames. */
async function searchViaGoogle(query: string, ctx: SearchContext): Promise<string[]> {
  const usernames = new Set<string>();

  for (let start = 0; start < 40 && usernames.size < ctx.limit; start += 10) {
    const page = await ctx.newPage();
    try {
      const q = encodeURIComponent(`site:instagram.com ${query}`);
      await page.goto(`https://www.google.com/search?q=${q}&num=20&hl=ko&start=${start}`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      const url = page.url();
      const body = (await page.textContent('body').catch(() => '')) ?? '';

      // Cookie consent — pick the privacy-preserving option (reject) if shown.
      if (
        url.includes('consent.google.com') ||
        body.includes('쿠키 사용') ||
        body.includes('before you continue')
      ) {
        const reject = page.getByRole('button', { name: /모두 거부|Reject all|거부/i }).first();
        if (await reject.isVisible({ timeout: 2000 }).catch(() => false)) {
          await reject.click().catch(() => undefined);
          await page.waitForTimeout(1000);
        }
      }

      // Captcha / block — do NOT bypass; fail the job with the cause.
      if (
        url.includes('/sorry/') ||
        body.includes('unusual traffic') ||
        body.includes('automated')
      ) {
        throw new BlockedError('google_captcha');
      }

      const links = await page.$$eval('a[href]', (els) =>
        els.map((e) => e.getAttribute('href') ?? '').filter((h) => h.includes('instagram.com/')),
      );
      for (const link of links) {
        const u = usernameFromUrl(link);
        if (u) usernames.add(u);
        if (usernames.size >= ctx.limit) break;
      }

      if (links.length === 0) break; // no more results
      await page.waitForTimeout(1500); // gentle pacing between pages
    } finally {
      await page.close().catch(() => undefined);
    }
  }

  return [...usernames];
}

/** Enrich a username from its public profile page (best-effort; never throws). */
async function enrichProfile(
  username: string,
  source: string,
  ctx: SearchContext,
): Promise<NormalizedCreator> {
  const base: NormalizedCreator = {
    platform: 'instagram',
    externalId: `instagram:${username}`,
    username,
    displayName: username,
    profileUrl: `https://www.instagram.com/${username}/`,
    profileImageUrl: null,
    biography: null,
    followersCount: null,
    followingCount: null,
    postsCount: null,
    isVerified: false,
    category: null,
    rawData: { source, username },
  };

  const page = await ctx.newPage();
  try {
    await page.goto(base.profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const ogTitle = await metaContent(page, 'meta[property="og:title"]');
    const ogDesc = await metaContent(page, 'meta[property="og:description"]');
    const ogImage = await metaContent(page, 'meta[property="og:image"]');

    // og:title is usually "Display Name (@username) • Instagram photos and videos"
    const displayName = ogTitle ? ogTitle.replace(/\s*\(@.*$/, '').trim() || username : username;
    const counts = parseCounts(ogDesc);

    return {
      ...base,
      displayName,
      profileImageUrl: ogImage ?? null,
      biography: ogDesc ?? null,
      followersCount: counts.followers,
      followingCount: counts.following,
      postsCount: counts.posts,
      rawData: { source: `${source}+profile`, username, ogTitle, ogDescription: ogDesc, ogImage },
    };
  } catch {
    return base; // profile blocked/unavailable — keep username + URL (req: "가능한 범위")
  } finally {
    await page.close().catch(() => undefined);
  }
}

export const instagramProvider: SearchProvider = {
  platform: 'instagram',
  async search(query, ctx) {
    let usernames: string[] = [];
    let source = 'instagram';

    // 1) Instagram web search — the primary path, tried to the end.
    try {
      usernames = await searchViaInstagram(query, ctx);
      ctx.log(`instagram search returned ${usernames.length} usernames`);
    } catch (err) {
      if (!(err instanceof BlockedError)) throw err;
      // 2) Google is used ONLY when Instagram itself is blocked/unavailable.
      //    err.reason is exactly instagram_login_required | instagram_search_unavailable.
      ctx.log(`INSTAGRAM FAILED: reason=${err.reason} → falling back to Google`);
      source = 'google';
      usernames = await searchViaGoogle(query, ctx);
      ctx.log(`google fallback found ${usernames.length} usernames`);
    }

    usernames = usernames.slice(0, ctx.limit);

    // Enrich each profile (best-effort) — username + profileUrl always survive.
    const creators: NormalizedCreator[] = [];
    for (const username of usernames) {
      creators.push(await enrichProfile(username, source, ctx));
    }
    return creators;
  },
};
