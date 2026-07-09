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
