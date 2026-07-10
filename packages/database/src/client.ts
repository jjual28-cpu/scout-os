import { PrismaClient } from '@prisma/client';

/**
 * Lazily-constructed, shared PrismaClient.
 *
 * The MVP runs without a database, and `DATABASE_URL` may be absent at build
 * time (Vercel). Constructing `new PrismaClient()` eagerly would throw when the
 * connection string is missing, failing the build. So we defer construction:
 * the client is created on FIRST property access (i.e. the first query), which
 * only happens when a DB-backed API is actually called.
 *
 * In development it's cached on `globalThis` so Next.js hot-reloads don't exhaust
 * the connection pool.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
    });
  }
  return globalForPrisma.prisma;
}

/**
 * Proxy that forwards to a real PrismaClient, constructed on first use. Importing
 * this module (e.g. during `next build`) never instantiates PrismaClient.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
