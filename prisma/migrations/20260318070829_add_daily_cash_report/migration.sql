-- CreateTable
CREATE TABLE "daily_cash_reports" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "total_sales" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "food_expense" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "other_expense" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "purchase_from_sales" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "online_cash" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "advance_salary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_cash_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_cash_reports_date_key" ON "daily_cash_reports"("date");

-- CreateIndex
CREATE INDEX "daily_cash_reports_date_idx" ON "daily_cash_reports"("date");
