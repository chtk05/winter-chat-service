import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

/**
 * D-031: the one place a real database client is constructed. Memoized on `globalThis`
 * so Next.js dev-mode hot reload does not open a fresh connection pool on every reload
 * (the standard guard for this pattern, not specific to this app).
 *
 * No caller exists yet — D-032 removed the one model (`LoginAttempt`) that used this.
 * Kept for T-003, which needs the same construction for its own models.
 */
const globalForPrisma = globalThis as unknown as {
  prismaClient?: PrismaClient;
};

export function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prismaClient) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set");
    }
    const adapter = new PrismaPg({ connectionString });
    globalForPrisma.prismaClient = new PrismaClient({ adapter });
  }
  return globalForPrisma.prismaClient;
}
