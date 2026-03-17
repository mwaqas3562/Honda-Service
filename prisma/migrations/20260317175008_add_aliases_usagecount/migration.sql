-- AlterTable
ALTER TABLE "parts" ADD COLUMN     "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "usage_count" INTEGER NOT NULL DEFAULT 0;
