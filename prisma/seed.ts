import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Create a staff member
  const staff = await prisma.staff.create({
    data: {
      name: 'Test Mechanic',
      role: 'mechanic',
      contact: '1234567890',
      status: 'active',
    },
  });

  // Create a bonus config for the staff
  await prisma.staffBonusConfig.create({
    data: {
      staffId: staff.id,
      minJobcardAmount: 1000,
      bonusType: 'flat',
      bonusValue: 200,
      active: true,
    },
  });

  // Create a job card
  const jobCard = await prisma.jobCard.create({
    data: {
      jobCardNumber: 'JC-TEST-001',
      customerName: 'Test Customer',
      customerPhone: '1234567890',
      vehicleNumber: 'ABC123',
      meterReading: 1000,
      bikeModel: 'CG-125',
      laborCost: 2000,
      status: 'open',
      staffAssignments: {
        create: [{
          staffId: staff.id,
          labourType: 'Engine Tuning',
          hoursSpent: 2,
        }],
      },
    },
  });

  // Update salePrice for all inventory items where salePrice is 0
  const parts = await prisma.part.findMany({ where: { salePrice: 0 } });
  for (const part of parts) {
    const newSalePrice = Math.round(Number(part.purchasePrice) * 1.3 * 100) / 100;
    await prisma.part.update({
      where: { id: part.id },
      data: { salePrice: newSalePrice },
    });
  }

  console.log('Seed data created and inventory sale prices updated:', { staff, jobCard });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
