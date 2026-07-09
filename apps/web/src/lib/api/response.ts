import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

/**
 * Standard API envelope so every route handler returns a consistent shape:
 *   success → { data }
 *   failure → { error: { code, message, details? } }
 */
export type ApiSuccess<T> = { data: T };
export type ApiError = {
  error: { code: string; message: string; details?: unknown };
};

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<ApiSuccess<T>>({ data }, init);
}

export function created<T>(data: T) {
  return ok(data, { status: 201 });
}

export function fail(code: string, message: string, status = 400, details?: unknown) {
  return NextResponse.json<ApiError>({ error: { code, message, details } }, { status });
}

/** Known application error with an HTTP status, thrown from services. */
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Wrap a route handler so thrown errors become the standard error envelope.
 * ZodErrors → 422, AppErrors → their status, everything else → 500.
 */
export function withErrorHandling<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof ZodError) {
        return fail('VALIDATION_ERROR', 'Invalid request', 422, error.flatten());
      }
      if (error instanceof AppError) {
        return fail(error.code, error.message, error.status, error.details);
      }
      console.error('Unhandled API error:', error);
      return fail('INTERNAL_ERROR', 'Something went wrong', 500);
    }
  };
}
