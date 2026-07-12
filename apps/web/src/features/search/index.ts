/** Public API of the Search feature (mock-only — no engine connected). */
export { SearchExperience } from './components/search-experience';
export { DailyDiscovery } from './components/daily-discovery';
export { SavedList } from './components/saved-list';
export { OutreachList } from './components/outreach-list';
export { FollowUpToday } from './components/follow-up-today';
export { CreatorDetail } from './components/creator-detail';
export { ResultCard } from './components/result-card';
export { useSearch } from './hooks/use-search';
export { useSavedOpportunities } from './hooks/use-saved-opportunities';
export { useDmDrafts } from './hooks/use-dm-drafts';
export { generateDmDraft } from './dm';
export { MOCK_RESULTS, SEARCH_PLACEHOLDERS, DEFAULT_RECENT_SEARCHES } from './mock-data';
export type {
  SearchResult,
  SearchResultType,
  SearchPlatform,
  SavedOpportunity,
  OpportunityStatus,
} from './types';
