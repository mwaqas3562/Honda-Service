-- CreateEnum
CREATE TYPE "SaleType" AS ENUM ('sale', 'quick_service');

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "bike_number" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "sale_type" "SaleType" NOT NULL DEFAULT 'sale';

-- CreateIndex
CREATE INDEX "sales_sale_type_idx" ON "sales"("sale_type");
