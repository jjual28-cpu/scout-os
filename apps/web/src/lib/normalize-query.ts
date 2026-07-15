/**
 * Canonical search-query normalization used ONLY for comparison — cache lookup,
 * running-campaign lookup and duplicate checks. The raw user input is what gets
 * stored in `campaigns.query`; the DB mirrors this rule in the generated column
 * `campaigns.query_norm`:
 *
 *   lower(btrim(regexp_replace(query, '\s+', ' ', 'g')))
 *
 * Keep the two in sync — every comparison goes through one of them.
 */
export function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ').toLowerCase();
}
