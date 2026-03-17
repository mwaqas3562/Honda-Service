-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "job_card_id" INTEGER;

-- CreateIndex
CREATE INDEX "sales_job_card_id_idx" ON "sales"("job_card_id");

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_job_card_id_fkey" FOREIGN KEY ("job_card_id") REFERENCES "job_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;
