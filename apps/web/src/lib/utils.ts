import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge conditional class names and de-duplicate conflicting Tailwind classes. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Compact large follower counts, e.g. 1_540_000 → "1.5M". */
export function formatCompactNumber(value: number | null | undefined): string {
  if (value == null) return '—';
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(
    value,
  );
}

/** Format a KRW-first currency amount. */
export function formatCurrency(amount: number | null | undefined, currency = 'KRW'): string {
  if (amount == null) return '—';
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency }).format(amount);
}

/** Format an engagement rate float as a percentage string. */
export function formatPercent(value: number | null | undefined, fractionDigits = 1): string {
  if (value == null) return '—';
  return `${value.toFixed(fractionDigits)}%`;
}

/**
 * 인스타/FB CDN 이미지 URL을 앱의 이미지 프록시(/api/img)로 감싼다. 인스타 CDN은
 * referer 로 핫링크를 막아 브라우저 <img>로 직접 부르면 일부가 안 뜨는데, 서버가 대신
 * 받아오면 전부 뜬다. 인스타/FB CDN URL만 감싸고 그 외(또는 null)는 그대로 돌려준다.
 */
const IMG_PROXY_HOST = /(^|\.)(cdninstagram\.com|fbcdn\.net|instagram\.com)$/i;
export function proxiedImg(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const h = new URL(url).hostname;
    if (IMG_PROXY_HOST.test(h)) return `/api/img?u=${encodeURIComponent(url)}`;
  } catch {
    /* not a parseable URL — return as-is */
  }
  return url;
}

/** Build a URL-friendly slug from an arbitrary string. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Copy text to the clipboard, resilient across environments. Tries the async
 * Clipboard API first (needs a secure context + focus), then falls back to the
 * legacy `execCommand('copy')` via a hidden textarea. Returns whether it worked.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
