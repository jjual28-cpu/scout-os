import { type ApiError } from './response';

/**
 * Thin typed fetch wrapper for client-side data fetching (used by React Query
 * hooks). Unwraps the `{ data }` envelope and throws `ApiClientError` on failure.
 */
export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  const payload = (await res.json().catch(() => null)) as { data: T } | ApiError | null;

  if (!res.ok || !payload || 'error' in payload) {
    const err = (payload as ApiError | null)?.error;
    throw new ApiClientError(
      err?.code ?? 'UNKNOWN',
      err?.message ?? res.statusText,
      res.status,
      err?.details,
    );
  }

  return payload.data;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
