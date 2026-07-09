/**
 * Public API of the Discovery feature. Import from `@/features/discovery`
 * rather than reaching into internal files — this barrel is the contract.
 */
export { DiscoveryLauncher } from './components/discovery-launcher';
export { CreatorGrid } from './components/creator-grid';
export { CreatorCard } from './components/creator-card';
export { useCreators } from './hooks/use-creators';
export { useDiscoveryRun } from './hooks/use-discovery-run';
export {
  creatorFiltersSchema,
  discoveryRunInputSchema,
  savedSearchInputSchema,
  type CreatorFilters,
  type DiscoveryRunInput,
  type SavedSearchInput,
} from './schemas';
export type { CreatorSummary, CreatorWithAccounts } from './types';

// Server-only service is intentionally NOT re-exported here to avoid pulling
// Prisma into client bundles. Import it directly from
// '@/features/discovery/services/discovery.service' in server code.
