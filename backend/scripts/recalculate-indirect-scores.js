const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('[Recalculate] Starting indirect score calculation...');

  // Get all KRs with their indirect_score
  const krs = await prisma.employeeKeyResult.findMany({
    select: {
      id: true,
      title: true,
      indirect_score: true,
    }
  });

  console.log(`[Recalculate] Found ${krs.length} KRs`);

  for (const kr of krs) {
    const krIndirectScore = kr.indirect_score;
    
    if (krIndirectScore === null || krIndirectScore === undefined) {
      console.log(`[Recalculate] KR ${kr.id} (${kr.title}) has no indirect_score, skipping`);
      continue;
    }

    console.log(`[Recalculate] Processing KR ${kr.id} (${kr.title}) - indirect_score: ${krIndirectScore}`);

    // Get monthly plans for this KR
    const monthlyPlans = await prisma.employeeMonthPlan.findMany({
      where: { employee_kr_id: kr.id },
      select: { id: true, title: true, weight_pct: true }
    });

    for (const plan of monthlyPlans) {
      const weightPct = plan.weight_pct;
      if (weightPct === null || weightPct === undefined) continue;

      // Calculate indirect_score for monthly plan
      // indirect_score = kr.indirect_score * (weight_pct / 100)
      const krScore = parseFloat(krIndirectScore.toString());
      const weight = parseFloat(weightPct.toString());
      const planIndirectScore = (krScore * weight / 100).toFixed(2);

      await prisma.employeeMonthPlan.update({
        where: { id: plan.id },
        data: { indirect_score: parseFloat(planIndirectScore) }
      });

      console.log(`[Recalculate] Updated monthly plan ${plan.id} (${plan.title}) - indirect_score: ${planIndirectScore}`);
    }

    // Get weekly plans through monthly plans
    for (const monthPlan of monthlyPlans) {
      const weeklyPlans = await prisma.weeklyPlan.findMany({
        where: { employee_month_plan_id: monthPlan.id },
        select: { id: true, title: true, weight_pct: true }
      });

      for (const plan of weeklyPlans) {
        const weightPct = plan.weight_pct;
        if (weightPct === null || weightPct === undefined) continue;

        // Calculate indirect_score for weekly plan
        const krScore = parseFloat(krIndirectScore.toString());
        const weight = parseFloat(weightPct.toString());
        const planIndirectScore = (krScore * weight / 100).toFixed(2);

        await prisma.weeklyPlan.update({
          where: { id: plan.id },
          data: { indirect_score: parseFloat(planIndirectScore) }
        });

        console.log(`[Recalculate] Updated weekly plan ${plan.id} (${plan.title}) - indirect_score: ${planIndirectScore}`);
      }
    }
  }

  console.log('[Recalculate] Done!');
}

main()
  .catch(e => {
    console.error('[Recalculate] Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
