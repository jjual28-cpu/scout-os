'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { DEFAULT_RECENT_SEARCHES, MOCK_RESULTS } from '../mock-data';
import { type SearchResult } from '../types';

const RECENT_KEY = 'scout:recent-searches';
const MAX_RECENT = 6;
/** Simulated latency so the transition to results feels deliberate, not instant. */
const MOCK_LATENCY_MS = 650;

type SearchStatus = 'idle' | 'searching' | 'results';

/**
 * Client-side controller for the Search experience. Deliberately returns MOCK
 * results only — no search engine is connected. It manages the query, a faux
 * "searching" state for premium feel, and a persisted recent-searches list.
 */
export function useSearch() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<SearchStatus>('idle');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeQuery, setActiveQuery] = useState('');
  const [recent, setRecent] = useState<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  // Load recent searches once on mount (falls back to seed values).
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(RECENT_KEY);
      setRecent(stored ? (JSON.parse(stored) as string[]) : DEFAULT_RECENT_SEARCHES);
    } catch {
      setRecent(DEFAULT_RECENT_SEARCHES);
    }
    return () => clearTimeout(timer.current);
  }, []);

  const persistRecent = useCallback((next: string[]) => {
    setRecent(next);
    try {
      window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      // ignore storage failures (private mode, quota, etc.)
    }
  }, []);

  const search = useCallback(
    (raw?: string) => {
      const q = (raw ?? query).trim();
      if (!q) return;

      setQuery(q);
      setActiveQuery(q);
      setStatus('searching');

      // Move this query to the front of the recent list (deduped, capped).
      persistRecent([q, ...recent.filter((r) => r !== q)].slice(0, MAX_RECENT));

      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setResults(MOCK_RESULTS);
        setStatus('results');
      }, MOCK_LATENCY_MS);
    },
    [query, recent, persistRecent],
  );

  const reset = useCallback(() => {
    clearTimeout(timer.current);
    setQuery('');
    setActiveQuery('');
    setResults([]);
    setStatus('idle');
  }, []);

  const clearRecent = useCallback(() => persistRecent([]), [persistRecent]);

  return {
    query,
    setQuery,
    status,
    results,
    activeQuery,
    recent,
    search,
    reset,
    clearRecent,
    isSearching: status === 'searching',
    hasResults: status === 'results',
  };
}
