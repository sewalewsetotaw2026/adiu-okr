const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Check KR data
  const kr = await prisma.employeeKeyResult.findFirst({
    include: {
      metricDefinition: true,
      progressUpdates: true,
      monthlyPlans: { 
        include: { 
          weeklyPlans: { include: { dailyPlans: true } }
        }
      },
      subtasks: true,
    }
  });
  
  console.log('KR:', kr?.title);
  console.log('Metric:', kr?.metricDefinition?.name, 'is_financial:', kr?.metricDefinition?.is_financial);
  console.log('target_value:', kr?.target_value?.toString());
  console.log('final_score:', kr?.final_score?.toString());
  console.log('indirect_score:', kr?.indirect_score?.toString());
  console.log('progressUpdates count:', kr?.progressUpdates?.length);
  console.log('monthlyPlans count:', kr?.monthlyPlans?.length);
  
  if (kr?.monthlyPlans) {
    for (let i = 0; i < kr.monthlyPlans.length; i++) {
      const mp = kr.monthlyPlans[i];
      console.log('  Monthly:', mp.title, 'progress_pct:', mp.progress_pct?.toString(), 'indirect_score:', mp.indirect_score?.toString());
      if (mp.weeklyPlans) {
        for (let j = 0; j < mp.weeklyPlans.length; j++) {
          const wp = mp.weeklyPlans[j];
          console.log('    Weekly:', wp.title, 'progress_pct:', wp.progress_pct?.toString(), 'indirect_score:', wp.indirect_score?.toString());
        }
      }
    }
  }
  
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
