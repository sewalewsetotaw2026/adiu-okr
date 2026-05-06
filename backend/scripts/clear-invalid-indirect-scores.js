const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('[Clear] Clearing invalid indirect_scores...');

  // Clear monthly plans with no progress
  const monthlyResult = await prisma.employeeMonthPlan.updateMany({
    where: {
      OR: [
        { progress_pct: null },
        { progress_pct: 0 },
      ],
      NOT: { indirect_score: null }
    },
    data: { indirect_score: null }
  });
  console.log(`[Clear] Cleared ${monthlyResult.count} monthly plans with no progress`);

  // Clear weekly plans with no progress
  const weeklyResult = await prisma.weeklyPlan.updateMany({
    where: {
      OR: [
        { progress_pct: null },
        { progress_pct: 0 },
      ],
      NOT: { indirect_score: null }
    },
    data: { indirect_score: null }
  });
  console.log(`[Clear] Cleared ${weeklyResult.count} weekly plans with no progress`);

  // Verify remaining indirect_scores
  const monthlyWithScore = await prisma.employeeMonthPlan.findMany({
    where: { NOT: { indirect_score: null } },
    select: { id: true, title: true, progress_pct: true, indirect_score: true }
  });
  console.log('\nMonthly plans WITH indirect_score:');
  for (const mp of monthlyWithScore) {
    console.log(`  - ${mp.title}: progress_pct=${mp.progress_pct?.toString()}, indirect_score=${mp.indirect_score?.toString()}`);
  }

  const weeklyWithScore = await prisma.weeklyPlan.findMany({
    where: { NOT: { indirect_score: null } },
    select: { id: true, title: true, progress_pct: true, indirect_score: true }
  });
  console.log('\nWeekly plans WITH indirect_score:');
  for (const wp of weeklyWithScore) {
    console.log(`  - ${wp.title}: progress_pct=${wp.progress_pct?.toString()}, indirect_score=${wp.indirect_score?.toString()}`);
  }

  console.log('\n[Clear] Done!');
  await prisma.$disconnect();
}

main().catch(e => { console.error('[Clear] Error:', e); process.exit(1); });
