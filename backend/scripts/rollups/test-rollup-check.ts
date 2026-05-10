/**
 * Quick diagnostic script to check the state of daily plans and their parent weekly plans.
 * Usage: npx ts-node -r tsconfig-paths/register test-rollup-check.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Get the most recently updated daily plans
  const recentDailies = await prisma.dailyPlan.findMany({
    orderBy: { updated_at: "desc" },
    take: 10,
    select: {
      id: true,
      title: true,
      weekly_plan_id: true,
      current_value: true,
      target_value: true,
      start_value: true,
      progress_pct: true,
      status: true,
      contribute_to_score: true,
      contribute_to_value: true,
      updated_at: true,
    },
  });

  console.log("\n=== RECENT DAILY PLANS (last 10 updated) ===");
  for (const d of recentDailies) {
    console.log(`  Daily id=${d.id} "${d.title}"`);
    console.log(`    weekly_plan_id: ${d.weekly_plan_id}`);
    console.log(`    current_value: ${d.current_value}, target_value: ${d.target_value}, start_value: ${d.start_value}`);
    console.log(`    progress_pct: ${d.progress_pct}, status: ${d.status}`);
    console.log(`    contribute_to_score: ${d.contribute_to_score}, contribute_to_value: ${d.contribute_to_value}`);
    console.log(`    updated_at: ${d.updated_at}`);
    console.log();
  }

  // Now get the weekly plans for those dailies
  const weeklyIds = [...new Set(recentDailies.map((d) => d.weekly_plan_id))];
  console.log("\n=== PARENT WEEKLY PLANS ===");
  for (const wid of weeklyIds) {
    const weekly = await prisma.weeklyPlan.findUnique({
      where: { id: wid },
      include: {
        metricDefinition: { select: { id: true, name: true, value_based_progress: true } },
        dailyPlans: {
          select: {
            id: true,
            title: true,
            current_value: true,
            target_value: true,
            progress_pct: true,
            contribute_to_score: true,
            contribute_to_value: true,
            status: true,
          },
        },
      },
    });
    if (!weekly) continue;

    console.log(`  Weekly id=${weekly.id} "${weekly.title}"`);
    console.log(`    current_value: ${weekly.current_value}, target_value: ${weekly.target_value}, start_value: ${weekly.start_value}`);
    console.log(`    progress_pct: ${weekly.progress_pct}`);
    console.log(`    contribute_to_score: ${weekly.contribute_to_score}, contribute_to_value: ${weekly.contribute_to_value}`);
    console.log(`    metric: ${weekly.metricDefinition ? `id=${weekly.metricDefinition.id} "${weekly.metricDefinition.name}" value_based=${weekly.metricDefinition.value_based_progress}` : "NULL"}`);
    console.log(`    aligned_manager_plan_id: ${weekly.aligned_manager_plan_id}`);
    console.log(`    employee_month_plan_id: ${weekly.employee_month_plan_id}`);
    console.log(`    dailyPlans (${weekly.dailyPlans.length}):`);
    for (const dp of weekly.dailyPlans) {
      console.log(`      - id=${dp.id} "${dp.title}": cur=${dp.current_value}, tgt=${dp.target_value}, pct=${dp.progress_pct}, score=${dp.contribute_to_score}, value=${dp.contribute_to_value}, status=${dp.status}`);
    }
    console.log();
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
