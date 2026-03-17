-- CreateTable
CREATE TABLE "job_cards" (
    "id" SERIAL NOT NULL,
    "job_card_number" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "customer_phone" TEXT NOT NULL,
    "vehicle_number" TEXT NOT NULL,
    "meter_reading" INTEGER NOT NULL,
    "bike_model" TEXT NOT NULL,
    "mechanic_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_cards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "job_cards_job_card_number_key" ON "job_cards"("job_card_number");

-- CreateIndex
CREATE INDEX "job_cards_job_card_number_idx" ON "job_cards"("job_card_number");

-- CreateIndex
CREATE INDEX "job_cards_customer_phone_idx" ON "job_cards"("customer_phone");

-- CreateIndex
CREATE INDEX "job_cards_vehicle_number_idx" ON "job_cards"("vehicle_number");
