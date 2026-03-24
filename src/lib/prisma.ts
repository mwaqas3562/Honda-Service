import { PrismaClient, Prisma } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Ensure Prisma Decimal values serialize as numbers in JSON responses
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(Prisma.Decimal.prototype as any).toJSON = function () {
  return Number(this);
};

// Models with soft-delete support
const SOFT_DELETE_MODELS = ["Sale", "Service", "JobCard", "Purchase", "Staff"] as const;

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const base = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

  // Add soft-delete extension: auto-filter deletedAt on reads, convert delete to update
  return base.$extends({
    query: {
      $allModels: {
        async findMany({ model, args, query }) {
          if (SOFT_DELETE_MODELS.includes(model as (typeof SOFT_DELETE_MODELS)[number])) {
            args.where = { deletedAt: null, ...args.where };
          }
          return query(args);
        },
        async findFirst({ model, args, query }) {
          if (SOFT_DELETE_MODELS.includes(model as (typeof SOFT_DELETE_MODELS)[number])) {
            args.where = { deletedAt: null, ...args.where };
          }
          return query(args);
        },
        async findUnique({ model, args, query }) {
          if (SOFT_DELETE_MODELS.includes(model as (typeof SOFT_DELETE_MODELS)[number])) {
            // findUnique doesn't support arbitrary where, so we proceed as-is
            // (deletedAt check should be done in app logic when needed)
          }
          return query(args);
        },
        async count({ model, args, query }) {
          if (SOFT_DELETE_MODELS.includes(model as (typeof SOFT_DELETE_MODELS)[number])) {
            args.where = { deletedAt: null, ...args.where };
          }
          return query(args);
        },
      },
    },
  });
}

const globalForPrisma = globalThis as unknown as { prisma: ReturnType<typeof createPrismaClient> };

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
