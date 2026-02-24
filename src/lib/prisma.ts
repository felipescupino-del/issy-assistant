// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient: PC } = require('../generated/prisma/client') as { PrismaClient: new () => import('../generated/prisma/client').PrismaClient };

const globalForPrisma = global as unknown as { prisma: import('../generated/prisma/client').PrismaClient };

// Prisma 7 requires either `adapter` or `accelerateUrl` in its type signature,
// but at runtime DATABASE_URL is read from the environment automatically.
// We bypass the TS constraint via require() and construct with no options.
export const prisma =
  globalForPrisma.prisma ??
  new PC();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
