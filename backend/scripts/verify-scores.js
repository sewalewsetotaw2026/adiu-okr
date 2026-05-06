const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Get objective with KRs
  const obj = await prisma.employeeObjective.findFirst({
    include: {
      keyResults: {
        select: { id: true, title: true, final_score: true, target_value: true, current_value: true }
      }
    }
  });
  
  console.log('Objective:', obj?.title);
  console.log('final_score:', obj?.final_score?.toString() || 'null');
  console.log('indirect_score:', obj?.indirect_score?.toString() || 'null');
  console.log('KRs:');
  for (const kr of obj?.keyResults || []) {
    console.log('  -', kr.title, 'final_score:', kr.final_score?.toString() || 'null', 'target:', kr.target_value?.toString() || 'null', 'current:', kr.current_value?.toString() || 'null');
  }
  
  // Check monthly plans
  const monthly = await prisma.employeeMonthPlan.findMany({
    select: { id: true, title: true, progress_pct: true, indirect_score: true }
  });
  
  console.log('\nMonthly plans:');
  for (const mp of monthly) {
    console.log('  -', mp.title, 'progress_pct:', mp.progress_pct?.toString() || 'null', 'indirect_score:', mp.indirect_score?.toString() || 'null');
  }
  
  // Check weekly plans
  const weekly = await prisma.weeklyPlan.findMany({
    select: { id: true, title: true, progress_pct: true, indirect_score: true }
  });
  
  console.log('\nWeekly plans:');
  for (const wp of weekly) {
    console.log('  -', wp.title, 'progress_pct:', wp.progress_pct?.toString() || 'null', 'indirect_score:', wp.indirect_score?.toString() || 'null');
  }
  
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
