-- Phase 2: Schema Migration
-- 1. Float → Decimal(12,2) for all monetary fields
-- 2. Remove Part.category string, migrate data to categories table
-- 3. Add vendor phone/address
-- 4. Add indexes on line-item FKs
-- 5. Add onDelete rules
-- 6. Remove deprecated DailyCashReport fields
-- 7. JobCardStaff.hoursSpent Float? → Decimal(6,2)

-- ============================================================
-- 1. Float → Decimal(12,2) conversions
-- ============================================================

-- Parts
ALTER TABLE "parts" ALTER COLUMN "purchase_price" SET DATA TYPE DECIMAL(12,2);
ALTER TABLE "parts" ALTER COLUMN "sale_price" SET DATA TYPE DECIMAL(12,2);

-- Stock Logs
ALTER TABLE "stock_logs" ALTER COLUMN "purchase_price" SET DATA TYPE DECIMAL(12,2);
ALTER TABLE "stock_logs" ALTER COLUMN "prev_price" SET DATA TYPE DECIMAL(12,2);

-- Purchases
ALTER TABLE "purchases" ALTER COLUMN "total" SET DATA TYPE DECIMAL(12,2);
ALTER TABLE "purchase_items" ALTER COLUMN "unit_price" SET DATA TYPE DECIMAL(12,2);
ALTER TABLE "purchase_items" ALTER COLUMN "total" SET DATA TYPE DECIMAL(12,2);

-- Labours
ALTER TABLE "labours" ALTER COLUMN "default_price" SET DATA TYPE DECIMAL(12,2);

-- Sales
ALTER TABLE "sales" ALTER COLUMN "labor_cost" SET DATA TYPE DECIMAL(12,2);
ALTER TABLE "sales" ALTER COLUMN "subtotal" SET DATA TYPE DECIMAL(12,2);
ALTER TABLE "sales" ALTER COLUMN "discount" SET DATA TYPE DECIMAL(12,2);
ALTER TABLE "sales" ALTER COLUMN "total" SET DATA TYPE DECIMAL(12,2);
ALTER TABLE "sale_items" ALTER COLUMN "unit_price" SET DATA TYPE DECIMAL(12,2);
ALTER TABLE "sale_items" ALTER COLUMN "total" SET DATA TYPE DECIMAL(12,2);
ALTER TABLE "sale_labour_items" ALTER COLUMN "unit_price" SET DATA TYPE DECIMAL(12,2);
ALTER TABLE "sale_labour_items" ALTER COLUMN "total" SET DATA TYPE DECIMAL(12,2);

-- Services
ALTER TABLE "services" ALTER COLUMN "labor_cost" SET DATA TYPE DECIMAL(12,2);
ALTER TABLE "services" ALTER COLUMN "total" SET DATA TYPE DECIMAL(12,2);
ALTER TABLE "service_items" ALTER COLUMN "unit_price" SET DATA TYPE DECIMAL(12,2);
ALTER TABLE "service_items" ALTER COLUMN "total" SET DATA TYPE DECIMAL(12,2);

-- Job Cards
ALTER TABLE "job_cards" ALTER COLUMN "labor_cost" SET DATA TYPE DECIMAL(12,2);

-- Staff Bonus
ALTER TABLE "staff_bonus_config" ALTER COLUMN "min_jobcard_amount" SET DATA TYPE DECIMAL(12,2);
ALTER TABLE "staff_bonus_config" ALTER COLUMN "bonus_value" SET DATA TYPE DECIMAL(12,2);
ALTER TABLE "staff_bonus_log" ALTER COLUMN "job_card_amount" SET DATA TYPE DECIMAL(12,2);
ALTER TABLE "staff_bonus_log" ALTER COLUMN "bonus_amount" SET DATA TYPE DECIMAL(12,2);
ALTER TABLE "staff_bonus_log" ALTER COLUMN "bonus_value" SET DATA TYPE DECIMAL(12,2);

-- Wheel Balancer
ALTER TABLE "wheel_balancer_config" ALTER COLUMN "bonus_value" SET DATA TYPE DECIMAL(12,2);
ALTER TABLE "wheel_balancer_performance" ALTER COLUMN "total_earnings" SET DATA TYPE DECIMAL(12,2);
ALTER TABLE "wheel_balancer_performance" ALTER COLUMN "bonus_amount" SET DATA TYPE DECIMAL(12,2);
ALTER TABLE "wheel_balancer_sale_log" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(12,2);

-- Daily Cash Report
ALTER TABLE "daily_cash_reports" ALTER COLUMN "advance_salary" SET DATA TYPE DECIMAL(12,2);

-- Expenses
ALTER TABLE "expenses" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(12,2);

-- JobCardStaff hoursSpent
ALTER TABLE "jobcard_staff" ALTER COLUMN "hours_spent" SET DATA TYPE DECIMAL(6,2);

-- ============================================================
-- 2. Migrate Part.category string → categories table + category_id FK
-- ============================================================

-- 2a. Populate categories table from distinct part categories
INSERT INTO "categories" ("name", "created_at")
SELECT DISTINCT "category", NOW()
FROM "parts"
WHERE "category" IS NOT NULL AND "category" != ''
ON CONFLICT ("name") DO NOTHING;

-- 2b. Populate category_id on parts from the category string
UPDATE "parts" p
SET "category_id" = c."id"
FROM "categories" c
WHERE p."category" = c."name" AND p."category_id" IS NULL;

-- 2c. Drop the old category string column
ALTER TABLE "parts" DROP COLUMN "category";

-- 2d. Drop the old index on category string (if exists)
DROP INDEX IF EXISTS "parts_category_idx";

-- ============================================================
-- 3. Vendor phone/address fields
-- ============================================================

ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "address" TEXT;

-- ============================================================
-- 4. Add indexes on line-item FKs (if not exists)
-- ============================================================

CREATE INDEX IF NOT EXISTS "purchase_items_purchase_id_idx" ON "purchase_items"("purchase_id");
CREATE INDEX IF NOT EXISTS "purchase_items_part_id_idx" ON "purchase_items"("part_id");
CREATE INDEX IF NOT EXISTS "sale_items_sale_id_idx" ON "sale_items"("sale_id");
CREATE INDEX IF NOT EXISTS "sale_items_part_id_idx" ON "sale_items"("part_id");
CREATE INDEX IF NOT EXISTS "sale_labour_items_sale_id_idx" ON "sale_labour_items"("sale_id");
CREATE INDEX IF NOT EXISTS "sale_labour_items_labour_id_idx" ON "sale_labour_items"("labour_id");
CREATE INDEX IF NOT EXISTS "service_items_service_id_idx" ON "service_items"("service_id");
CREATE INDEX IF NOT EXISTS "service_items_part_id_idx" ON "service_items"("part_id");

-- ============================================================
-- 5. Add WheelBalancerSaleLog FK to Sale (sale_id unique + FK)
-- ============================================================

-- Make sale_id unique if not already
CREATE UNIQUE INDEX IF NOT EXISTS "wheel_balancer_sale_log_sale_id_key" ON "wheel_balancer_sale_log"("sale_id");

-- Add FK from wheel_balancer_sale_log.sale_id → sales.id with CASCADE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'wheel_balancer_sale_log_sale_id_fkey'
  ) THEN
    ALTER TABLE "wheel_balancer_sale_log"
      ADD CONSTRAINT "wheel_balancer_sale_log_sale_id_fkey"
      FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================================
-- 6. Remove deprecated DailyCashReport fields
-- ============================================================

ALTER TABLE "daily_cash_reports" DROP COLUMN IF EXISTS "total_sales";
ALTER TABLE "daily_cash_reports" DROP COLUMN IF EXISTS "food_expense";
ALTER TABLE "daily_cash_reports" DROP COLUMN IF EXISTS "other_expense";
ALTER TABLE "daily_cash_reports" DROP COLUMN IF EXISTS "purchase_from_sales";
ALTER TABLE "daily_cash_reports" DROP COLUMN IF EXISTS "online_cash";
ALTER TABLE "daily_cash_reports" DROP COLUMN IF EXISTS "net_cash";
ALTER TABLE "daily_cash_reports" DROP COLUMN IF EXISTS "total_expenses";
ALTER TABLE "daily_cash_reports" DROP COLUMN IF EXISTS "total_purchases";

-- ============================================================
-- 7. Update ON DELETE rules for existing FKs
-- ============================================================

-- Purchase → Vendor: RESTRICT (prevent deleting vendor with purchases)
ALTER TABLE "purchases" DROP CONSTRAINT IF EXISTS "purchases_vendor_id_fkey";
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_vendor_id_fkey"
  FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Sale → JobCard: SET NULL
ALTER TABLE "sales" DROP CONSTRAINT IF EXISTS "sales_job_card_id_fkey";
ALTER TABLE "sales" ADD CONSTRAINT "sales_job_card_id_fkey"
  FOREIGN KEY ("job_card_id") REFERENCES "job_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Part → Category: SET NULL
-- (Already set via schema, but ensure FK exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'parts_category_id_fkey'
  ) THEN
    ALTER TABLE "parts"
      ADD CONSTRAINT "parts_category_id_fkey"
      FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Part → Subcategory: SET NULL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'parts_subcategory_id_fkey'
  ) THEN
    ALTER TABLE "parts"
      ADD CONSTRAINT "parts_subcategory_id_fkey"
      FOREIGN KEY ("subcategory_id") REFERENCES "subcategories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- SaleItem → Part: RESTRICT
ALTER TABLE "sale_items" DROP CONSTRAINT IF EXISTS "sale_items_part_id_fkey";
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_part_id_fkey"
  FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- PurchaseItem → Part: RESTRICT
ALTER TABLE "purchase_items" DROP CONSTRAINT IF EXISTS "purchase_items_part_id_fkey";
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_part_id_fkey"
  FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ServiceItem → Part: RESTRICT
ALTER TABLE "service_items" DROP CONSTRAINT IF EXISTS "service_items_part_id_fkey";
ALTER TABLE "service_items" ADD CONSTRAINT "service_items_part_id_fkey"
  FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- SaleLabourItem → Labour: RESTRICT
ALTER TABLE "sale_labour_items" DROP CONSTRAINT IF EXISTS "sale_labour_items_labour_id_fkey";
ALTER TABLE "sale_labour_items" ADD CONSTRAINT "sale_labour_items_labour_id_fkey"
  FOREIGN KEY ("labour_id") REFERENCES "labours"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
