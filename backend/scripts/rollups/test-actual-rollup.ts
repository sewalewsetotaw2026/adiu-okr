/**
 * Test calling the actual recalculateRollUp function directly.
 * Usage: npx ts-node -r tsconfig-paths/register test-actual-rollup.ts
 */

// Import directly from the service 
import { recalculateRollUp } from "../../src/services/okrRollupService";

async function main() {
  console.log("\n=== TRIGGERING ACTUAL recalculateRollUp('weekly_plan', 11) ===\n");
  try {
    await recalculateRollUp("weekly_plan", 11);
    console.log("\n=== DONE - Check debug output above ===\n");
  } catch (err: any) {
    console.error("ROLLUP FAILED:", err.message);
    console.error(err.stack);
  }

  // Now check the result
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();
  const weekly = await prisma.weeklyPlan.findUnique({ where: { id: 11 } });
  console.log(`\nWeekly Plan 11 AFTER rollup:`);
  console.log(`  current_value: ${weekly?.current_value}`);
  console.log(`  progress_pct: ${weekly?.progress_pct}`);
  await prisma.$disconnect();
}

main().catch(console.error);
