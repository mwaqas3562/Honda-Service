-- CreateTable
CREATE TABLE "parts" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "part_number" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "purchase_price" DOUBLE PRECISION NOT NULL,
    "sale_price" DOUBLE PRECISION NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "min_stock" INTEGER NOT NULL DEFAULT 5,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_logs" (
    "id" SERIAL NOT NULL,
    "part_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "prev_stock" INTEGER NOT NULL,
    "new_stock" INTEGER NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "parts_part_number_key" ON "parts"("part_number");

-- CreateIndex
CREATE INDEX "parts_category_idx" ON "parts"("category");

-- CreateIndex
CREATE INDEX "parts_name_idx" ON "parts"("name");

-- CreateIndex
CREATE INDEX "stock_logs_part_id_idx" ON "stock_logs"("part_id");

-- CreateIndex
CREATE INDEX "stock_logs_type_idx" ON "stock_logs"("type");

-- CreateIndex
CREATE INDEX "stock_logs_created_at_idx" ON "stock_logs"("created_at");

-- AddForeignKey
ALTER TABLE "stock_logs" ADD CONSTRAINT "stock_logs_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
