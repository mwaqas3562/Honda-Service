-- AlterTable
ALTER TABLE "job_cards" ADD COLUMN     "labor_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'open';

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "labor_cost" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "job_cards_status_idx" ON "job_cards"("status");
