-- CreateEnum: StockLogType
CREATE TYPE "StockLogType" AS ENUM ('purchase', 'sale', 'service', 'adjustment');

-- CreateEnum: PurchaseStatus
CREATE TYPE "PurchaseStatus" AS ENUM ('ordered', 'in_transit', 'received');

-- CreateEnum: PaymentType
CREATE TYPE "PaymentType" AS ENUM ('cash', 'card', 'credit', 'online');

-- CreateEnum: SaleStatus
CREATE TYPE "SaleStatus" AS ENUM ('draft', 'final');

-- CreateEnum: ServiceType
CREATE TYPE "ServiceType" AS ENUM ('oil_change', 'engine_tune_up', 'brake_service', 'chain_adjustment', 'full_service', 'clutch_replacement', 'electrical_repair', 'body_work', 'other');

-- CreateEnum: ServiceStatus
CREATE TYPE "ServiceStatus" AS ENUM ('pending', 'in_progress', 'completed');

-- CreateEnum: JobCardStatus
CREATE TYPE "JobCardStatus" AS ENUM ('open', 'completed');

-- CreateEnum: StaffRole
CREATE TYPE "StaffRole" AS ENUM ('job_card_person', 'mechanic', 'store_keeper', 'admin', 'wheel_balancer');

-- CreateEnum: StaffStatus
CREATE TYPE "StaffStatus" AS ENUM ('active', 'inactive');

-- CreateEnum: BonusType
CREATE TYPE "BonusType" AS ENUM ('flat', 'percentage');

-- CreateEnum: AttendanceStatus
CREATE TYPE "AttendanceStatus" AS ENUM ('present', 'absent');

-- CreateEnum: ExpenseType
CREATE TYPE "ExpenseType" AS ENUM ('food', 'utility', 'misc');

-- CreateEnum: AdminRole
CREATE TYPE "AdminRole" AS ENUM ('ADMIN');

-- AlterTable: stock_logs.type String → StockLogType
ALTER TABLE "stock_logs" ALTER COLUMN "type" TYPE "StockLogType" USING "type"::"StockLogType";

-- AlterTable: purchases.status String → PurchaseStatus (also change default from 'received' to 'ordered')
ALTER TABLE "purchases" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "purchases" ALTER COLUMN "status" TYPE "PurchaseStatus" USING "status"::"PurchaseStatus";
ALTER TABLE "purchases" ALTER COLUMN "status" SET DEFAULT 'ordered'::"PurchaseStatus";

-- AlterTable: sales.payment_type String → PaymentType
ALTER TABLE "sales" ALTER COLUMN "payment_type" DROP DEFAULT;
ALTER TABLE "sales" ALTER COLUMN "payment_type" TYPE "PaymentType" USING "payment_type"::"PaymentType";
ALTER TABLE "sales" ALTER COLUMN "payment_type" SET DEFAULT 'cash'::"PaymentType";

-- AlterTable: sales.status String → SaleStatus
ALTER TABLE "sales" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "sales" ALTER COLUMN "status" TYPE "SaleStatus" USING "status"::"SaleStatus";
ALTER TABLE "sales" ALTER COLUMN "status" SET DEFAULT 'draft'::"SaleStatus";

-- AlterTable: services.service_type String → ServiceType (convert human-readable values)
ALTER TABLE "services" ALTER COLUMN "service_type" TYPE "ServiceType" USING
  CASE "service_type"
    WHEN 'Oil Change' THEN 'oil_change'::"ServiceType"
    WHEN 'Engine Tune-up' THEN 'engine_tune_up'::"ServiceType"
    WHEN 'Brake Service' THEN 'brake_service'::"ServiceType"
    WHEN 'Chain Adjustment' THEN 'chain_adjustment'::"ServiceType"
    WHEN 'Full Service' THEN 'full_service'::"ServiceType"
    WHEN 'Clutch Replacement' THEN 'clutch_replacement'::"ServiceType"
    WHEN 'Electrical Repair' THEN 'electrical_repair'::"ServiceType"
    WHEN 'Body Work' THEN 'body_work'::"ServiceType"
    ELSE 'other'::"ServiceType"
  END;

-- AlterTable: services.status String → ServiceStatus
ALTER TABLE "services" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "services" ALTER COLUMN "status" TYPE "ServiceStatus" USING "status"::"ServiceStatus";
ALTER TABLE "services" ALTER COLUMN "status" SET DEFAULT 'pending'::"ServiceStatus";

-- AlterTable: job_cards.status String → JobCardStatus
ALTER TABLE "job_cards" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "job_cards" ALTER COLUMN "status" TYPE "JobCardStatus" USING "status"::"JobCardStatus";
ALTER TABLE "job_cards" ALTER COLUMN "status" SET DEFAULT 'open'::"JobCardStatus";

-- AlterTable: staff.role String → StaffRole
ALTER TABLE "staff" ALTER COLUMN "role" TYPE "StaffRole" USING "role"::"StaffRole";

-- AlterTable: staff.status String → StaffStatus
ALTER TABLE "staff" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "staff" ALTER COLUMN "status" TYPE "StaffStatus" USING "status"::"StaffStatus";
ALTER TABLE "staff" ALTER COLUMN "status" SET DEFAULT 'active'::"StaffStatus";

-- AlterTable: staff_bonus_config.bonus_type String → BonusType
ALTER TABLE "staff_bonus_config" ALTER COLUMN "bonus_type" TYPE "BonusType" USING "bonus_type"::"BonusType";

-- AlterTable: staff_bonus_log.bonus_type String → BonusType
ALTER TABLE "staff_bonus_log" ALTER COLUMN "bonus_type" TYPE "BonusType" USING "bonus_type"::"BonusType";

-- AlterTable: wheel_balancer_config.bonus_type String → BonusType
ALTER TABLE "wheel_balancer_config" ALTER COLUMN "bonus_type" DROP DEFAULT;
ALTER TABLE "wheel_balancer_config" ALTER COLUMN "bonus_type" TYPE "BonusType" USING "bonus_type"::"BonusType";
ALTER TABLE "wheel_balancer_config" ALTER COLUMN "bonus_type" SET DEFAULT 'flat'::"BonusType";

-- AlterTable: staff_attendance.status String → AttendanceStatus
ALTER TABLE "staff_attendance" ALTER COLUMN "status" TYPE "AttendanceStatus" USING "status"::"AttendanceStatus";

-- AlterTable: expenses.type String → ExpenseType
ALTER TABLE "expenses" ALTER COLUMN "type" TYPE "ExpenseType" USING "type"::"ExpenseType";

-- AlterTable: admin_users.role String → AdminRole
ALTER TABLE "admin_users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "admin_users" ALTER COLUMN "role" TYPE "AdminRole" USING "role"::"AdminRole";
ALTER TABLE "admin_users" ALTER COLUMN "role" SET DEFAULT 'ADMIN'::"AdminRole";

-- CreateSequence: atomic job card number generation
CREATE SEQUENCE IF NOT EXISTS "job_card_number_seq";
SELECT setval('job_card_number_seq', COALESCE((SELECT MAX(CAST("job_card_number" AS INTEGER)) FROM "job_cards" WHERE "job_card_number" ~ '^\d+$'), 0));

-- Soft-delete: add deletedAt columns
ALTER TABLE "purchases" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "sales" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "services" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "job_cards" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "staff" ADD COLUMN "deleted_at" TIMESTAMP(3);

-- Link Service to JobCard via optional FK
ALTER TABLE "services" ADD COLUMN "job_card_id" INTEGER;
CREATE INDEX "services_job_card_id_idx" ON "services"("job_card_id");
ALTER TABLE "services" ADD CONSTRAINT "services_job_card_id_fkey" FOREIGN KEY ("job_card_id") REFERENCES "job_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;
