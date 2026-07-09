import { PrismaClient } from '@prisma/client';

/**
 * A single PrismaClient instance is shared across the process. In development,
 * Next.js hot-reloading would otherwise create a new client on every change and
 * exhaust the database connection pool — so we cache it on `globalThis`.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
