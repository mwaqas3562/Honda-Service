/*
  Warnings:

  - You are about to drop the column `customer_name` on the `sales` table. All the data in the column will be lost.
  - You are about to drop the column `customer_phone` on the `sales` table. All the data in the column will be lost.
  - You are about to drop the column `note` on the `sales` table. All the data in the column will be lost.
  - You are about to drop the column `payment_method` on the `sales` table. All the data in the column will be lost.
  - Added the required column `updated_at` to the `sales` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "sales" DROP COLUMN "customer_name",
DROP COLUMN "customer_phone",
DROP COLUMN "note",
DROP COLUMN "payment_method",
ADD COLUMN     "customer" TEXT,
ADD COLUMN     "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "payment_type" TEXT NOT NULL DEFAULT 'cash',
ADD COLUMN     "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "sales_date_idx" ON "sales"("date");
