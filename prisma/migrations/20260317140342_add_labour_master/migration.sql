-- CreateTable
CREATE TABLE "labours" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "default_price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "labours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_labour_items" (
    "id" SERIAL NOT NULL,
    "sale_id" INTEGER NOT NULL,
    "labour_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "sale_labour_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "labours_name_idx" ON "labours"("name");

-- AddForeignKey
ALTER TABLE "sale_labour_items" ADD CONSTRAINT "sale_labour_items_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_labour_items" ADD CONSTRAINT "sale_labour_items_labour_id_fkey" FOREIGN KEY ("labour_id") REFERENCES "labours"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
