import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  const email = "admin@honda.com";
  const password = "admin123"; // Change this in production!

  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin user already exists: ${email}`);
  } else {
    const hash = await bcrypt.hash(password, 12);
    await prisma.adminUser.create({
      data: {
        email,
        password: hash,
        name: "Admin",
        role: "ADMIN",
      },
    });
    console.log(`Admin user created: ${email} / ${password}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
