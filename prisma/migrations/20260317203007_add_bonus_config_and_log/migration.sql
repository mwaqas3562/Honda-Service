-- CreateTable
CREATE TABLE "staff_bonus_config" (
    "id" SERIAL NOT NULL,
    "staff_id" INTEGER NOT NULL,
    "min_jobcard_amount" DOUBLE PRECISION NOT NULL,
    "bonus_type" TEXT NOT NULL,
    "bonus_value" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_bonus_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_bonus_log" (
    "id" SERIAL NOT NULL,
    "staff_id" INTEGER NOT NULL,
    "job_card_id" INTEGER NOT NULL,
    "job_card_amount" DOUBLE PRECISION NOT NULL,
    "bonus_amount" DOUBLE PRECISION NOT NULL,
    "bonus_type" TEXT NOT NULL,
    "bonus_value" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_bonus_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_bonus_config_staff_id_key" ON "staff_bonus_config"("staff_id");

-- CreateIndex
CREATE INDEX "staff_bonus_log_staff_id_idx" ON "staff_bonus_log"("staff_id");

-- CreateIndex
CREATE INDEX "staff_bonus_log_job_card_id_idx" ON "staff_bonus_log"("job_card_id");

-- CreateIndex
CREATE INDEX "staff_bonus_log_created_at_idx" ON "staff_bonus_log"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "staff_bonus_log_staff_id_job_card_id_key" ON "staff_bonus_log"("staff_id", "job_card_id");

-- AddForeignKey
ALTER TABLE "staff_bonus_config" ADD CONSTRAINT "staff_bonus_config_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_bonus_log" ADD CONSTRAINT "staff_bonus_log_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_bonus_log" ADD CONSTRAINT "staff_bonus_log_job_card_id_fkey" FOREIGN KEY ("job_card_id") REFERENCES "job_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
