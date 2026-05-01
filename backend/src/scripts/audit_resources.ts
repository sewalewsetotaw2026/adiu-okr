
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function auditResources() {
  console.log("--- Resource Audit ---");

  // 1. Get resources from DB
  const dbResources = await prisma.appResource.findMany({
    orderBy: { code: 'asc' }
  });
  const dbResourceCodes = dbResources.map(r => r.code);

  console.log("Resources in Database:");
  dbResourceCodes.forEach(code => console.log(` - ${code}`));

  // 2. Identify models that might be missing
  const models = [
    "EmployeeDocument",
    "EmployeeCostSharing",
    "LeaveCashOut",
    "Celebration",
    "Notification"
  ];

  console.log("\nPotential Missing Resources (Models not in DB Resource table):");
  for (const model of models) {
    const code = model.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();
    if (!dbResourceCodes.includes(code)) {
      console.log(` [MISSING] ${code} (Table: ${model})`);
    }
  }

  await prisma.$disconnect();
}

auditResources().catch(console.error);
