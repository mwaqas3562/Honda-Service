-- CreateTable
CREATE TABLE "wheel_balancer_config" (
    "id" SERIAL NOT NULL,
    "staff_id" INTEGER NOT NULL,
    "bonus_threshold" INTEGER NOT NULL DEFAULT 100,
    "bonus_type" TEXT NOT NULL DEFAULT 'flat',
    "bonus_value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wheel_balancer_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wheel_balancer_performance" (
    "id" SERIAL NOT NULL,
    "staff_id" INTEGER NOT NULL,
    "month" TEXT NOT NULL,
    "service_count" INTEGER NOT NULL DEFAULT 0,
    "total_earnings" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bonus_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wheel_balancer_performance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wheel_balancer_sale_log" (
    "id" SERIAL NOT NULL,
    "sale_id" INTEGER NOT NULL,
    "staff_id" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "month" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wheel_balancer_sale_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wheel_balancer_config_staff_id_key" ON "wheel_balancer_config"("staff_id");

-- CreateIndex
CREATE INDEX "wheel_balancer_performance_staff_id_idx" ON "wheel_balancer_performance"("staff_id");

-- CreateIndex
CREATE INDEX "wheel_balancer_performance_month_idx" ON "wheel_balancer_performance"("month");

-- CreateIndex
CREATE UNIQUE INDEX "wheel_balancer_performance_staff_id_month_key" ON "wheel_balancer_performance"("staff_id", "month");

-- CreateIndex
CREATE UNIQUE INDEX "wheel_balancer_sale_log_sale_id_key" ON "wheel_balancer_sale_log"("sale_id");

-- CreateIndex
CREATE INDEX "wheel_balancer_sale_log_staff_id_idx" ON "wheel_balancer_sale_log"("staff_id");

-- CreateIndex
CREATE INDEX "wheel_balancer_sale_log_month_idx" ON "wheel_balancer_sale_log"("month");

-- AddForeignKey
ALTER TABLE "wheel_balancer_config" ADD CONSTRAINT "wheel_balancer_config_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wheel_balancer_performance" ADD CONSTRAINT "wheel_balancer_performance_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wheel_balancer_sale_log" ADD CONSTRAINT "wheel_balancer_sale_log_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
