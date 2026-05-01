import { prisma } from "./lib/prisma";
import { recalculateCompanyLeaveBalances } from "./utils/leaveUtils";

async function main() {
  const companies = await prisma.company.findMany({ select: { id: true, name: true } });
  console.log(`Found ${companies.length} companies. Starting bulk recalculation...`);

  for (const company of companies) {
    console.log(`Processing company: ${company.name} (ID: ${company.id})...`);
    await recalculateCompanyLeaveBalances(company.id, prisma);
  }

  console.log("Bulk recalculation complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
