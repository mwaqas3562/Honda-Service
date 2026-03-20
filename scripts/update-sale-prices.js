// Bulk update sale_price for all inventory items with a 30% margin on purchase_price
// Requirements: Only update sale_price where purchase_price > 0 and sale_price is null or 0
// Log updated and skipped counts, return summary

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
console.log('Sale price update script started...');

async function main() {
  try {
    // Count total items
    const total = await prisma.part.count();

    // Count items eligible for update (purchasePrice > 0 and salePrice is 0)
    const toUpdate = await prisma.part.count({
      where: {
        purchasePrice: { gt: 0 },
        salePrice: { equals: 0 },
      },
    });

    // Count skipped items (those not eligible)
    const skipped = total - toUpdate;

    // Perform bulk update
    const result = await prisma.$executeRaw`UPDATE parts SET sale_price = ROUND(purchase_price * 1.3) WHERE purchase_price > 0 AND sale_price = 0`;

    // Log summary
    console.log('--- Sale Price Update Summary ---');
    console.log('Total items:', total);
    console.log('Eligible for update:', toUpdate);
    console.log('Updated count (DB rows):', result);
    console.log('Skipped count:', skipped);

    if (toUpdate === 0) {
      console.log('No items matched the update criteria.');
    }

    return {
      total,
      eligible: toUpdate,
      updated: result,
      skipped,
    };
  } catch (err) {
    console.error('Error during sale price update:', err);
    throw err;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
