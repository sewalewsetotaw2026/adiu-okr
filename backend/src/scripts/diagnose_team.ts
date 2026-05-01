
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function diagnoseTeamVisibility() {
  console.log("--- Team Visibility Diagnostic ---");

  // 1. Find all manager_id values in Employment
  const managers = await prisma.employment.findMany({
    where: { manager_id: { not: null }, is_active: true },
    select: { manager_id: true, employee_id: true }
  });

  console.log(`Total active employments with a manager: ${managers.length}`);

  const uniqueManagers = [...new Set(managers.map(m => m.manager_id))];
  console.log(`Unique manager IDs in system: ${uniqueManagers.length}`);

  // 2. Check if these manager IDs exist in Employee table
  for (const mid of uniqueManagers) {
    if (!mid) continue;
    const emp = await prisma.employee.findUnique({
      where: { id: mid },
      select: { full_name: true }
    });
    if (!emp) {
      console.log(`[WARNING] Manager ID ${mid} NOT FOUND in Employee table!`);
    } else {
      const reports = managers.filter(m => m.manager_id === mid);
      console.log(`Manager ${emp.full_name} (${mid}) has ${reports.length} reports.`);
    }
  }

  // 3. Find if there are any managers with users but no employment?
  // (Unlikely to cause this issue but good to check)

  await prisma.$disconnect();
}

diagnoseTeamVisibility().catch(console.error);
