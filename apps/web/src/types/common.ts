// Cross-feature shared types. Feature-specific types live in each feature's own
// `types.ts` (e.g. features/discovery/types.ts).

export type Nullable<T> = T | null;

export type PaginatedResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};

export type SortDirection = 'asc' | 'desc';

export type Sort<TField extends string = string> = {
  field: TField;
  direction: SortDirection;
};

/** Shape of the authenticated principal available to server code. */
export type SessionContext = {
  userId: string;
  email: string;
  workspaceId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
};

/** Generic option used across selects/filters. */
export type SelectOption<T extends string = string> = {
  label: string;
  value: T;
};
