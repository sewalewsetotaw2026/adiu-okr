import { PrismaClient, Decimal } from '@prisma/client';

const prisma = new PrismaClient();

// Helper: check if value is a valid Decimal
function hasDecimal(value: Decimal | null | undefined): value is Decimal {
  return value !== null && value !== undefined;
}

async function main() {
  console.log('[Recalculate] Starting indirect score calculation...');

  // Get all KRs with their indirect_score
  const krs = await prisma.employeeKeyResult.findMany({
    select: {
      id: true,
      title: true,
      indirect_score: true,
      weight_percent: true,
      employee_objective_id: true,
    }
  });

  console.log(`[Recalculate] Found ${krs.length} KRs`);

  for (const kr of krs) {
    const krIndirectScore = kr.indirect_score;
    
    if (!hasDecimal(krIndirectScore)) {
      console.log(`[Recalculate] KR ${kr.id} (${kr.title}) has no indirect_score, skipping`);
      continue;
    }

    console.log(`[Recalculate] Processing KR ${kr.id} (${kr.title}) - indirect_score: ${krIndirectScore}`);

    // Get monthly plans for this KR
    const monthlyPlans = await prisma.employeeMonthPlan.findMany({
      where: { employee_kr_id: kr.id },
      select: { id: true, title: true, weight_pct: true, progress_pct: true }
    });

    for (const plan of monthlyPlans) {
      const weightPct = plan.weight_pct;
      if (weightPct === null || weightPct === undefined) continue;

      // Calculate indirect_score for monthly plan
      // indirect_score = kr.indirect_score * (weight_pct / 100)
      const weightDecimal = new Decimal(weightPct);
      const planIndirectScore = krIndirectScore.mul(weightDecimal.div(100));

      await prisma.employeeMonthPlan.update({
        where: { id: plan.id },
        data: { indirect_score: planIndirectScore }
      });

      console.log(`[Recalculate] Updated monthly plan ${plan.id} (${plan.title}) - indirect_score: ${planIndirectScore}`);
    }

    // Get weekly plans through monthly plans
    for (const monthPlan of monthlyPlans) {
      const weeklyPlans = await prisma.weeklyPlan.findMany({
        where: { employee_month_plan_id: monthPlan.id },
        select: { id: true, title: true, weight_pct: true, progress_pct: true }
      });

      for (const plan of weeklyPlans) {
        const weightPct = plan.weight_pct;
        if (weightPct === null || weightPct === undefined) continue;

        // Calculate indirect_score for weekly plan
        const weightDecimal = new Decimal(weightPct);
        const planIndirectScore = krIndirectScore.mul(weightDecimal.div(100));

        await prisma.weeklyPlan.update({
          where: { id: plan.id },
          data: { indirect_score: planIndirectScore }
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
