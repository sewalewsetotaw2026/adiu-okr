
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.bank.count();
  console.log(`Total Banks in DB: ${count}`);
  if (count > 0) {
    const banks = await prisma.bank.findMany({ take: 3 });
    console.log("Sample Banks:", banks);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
