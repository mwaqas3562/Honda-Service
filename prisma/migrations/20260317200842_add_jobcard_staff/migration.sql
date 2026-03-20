-- CreateTable
CREATE TABLE "jobcard_staff" (
    "id" SERIAL NOT NULL,
    "job_card_id" INTEGER NOT NULL,
    "staff_id" INTEGER NOT NULL,
    "labour_type" TEXT,
    "hours_spent" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jobcard_staff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "jobcard_staff_job_card_id_idx" ON "jobcard_staff"("job_card_id");

-- CreateIndex
CREATE INDEX "jobcard_staff_staff_id_idx" ON "jobcard_staff"("staff_id");

-- CreateIndex
CREATE UNIQUE INDEX "jobcard_staff_job_card_id_staff_id_key" ON "jobcard_staff"("job_card_id", "staff_id");

-- AddForeignKey
ALTER TABLE "jobcard_staff" ADD CONSTRAINT "jobcard_staff_job_card_id_fkey" FOREIGN KEY ("job_card_id") REFERENCES "job_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobcard_staff" ADD CONSTRAINT "jobcard_staff_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
