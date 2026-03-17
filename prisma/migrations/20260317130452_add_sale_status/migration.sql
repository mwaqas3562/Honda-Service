-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "finalized_at" TIMESTAMP(3),
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'draft';

-- CreateIndex
CREATE INDEX "sales_status_idx" ON "sales"("status");
