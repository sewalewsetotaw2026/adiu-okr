/**
 * Manually trigger recalculateRollUp for weekly plan 11 to see debug output.
 * Usage: npx ts-node -r tsconfig-paths/register test-trigger-rollup.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// We need to import the rollup function
// Since it's not exported from the module directly, we'll replicate the logic here
// to trace exactly what happens

const { Decimal } = require("@prisma/client/runtime/library");

function decOrZero(v: any): any {
  if (v == null) return new Decimal(0);
  try {
    return new Decimal(v.toString());
  } catch {
    return new Decimal(0);
  }
}

function clampPercent(d: any): any {
  if (d.lt(0)) return new Decimal(0);
  if (d.gt(100)) return new Decimal(100);
  return d;
}

function isValueBasedProgressMetric(metricDefinition: any): boolean {
  return metricDefinition?.value_based_progress === true;
}

async function testRollup() {
  const weeklyPlanId = 11;

  console.log(`\n========== MANUAL ROLLUP TEST for WeeklyPlan ${weeklyPlanId} ==========\n`);

  const weekly = await prisma.weeklyPlan.findUnique({
    where: { id: weeklyPlanId },
    include: { metricDefinition: true },
  });

  if (!weekly) {
    console.log("Weekly plan not found!");
    return;
  }

  const metric = weekly.metricDefinition;
  const isValueBased = isValueBasedProgressMetric(metric);

  console.log(`Weekly Plan ${weeklyPlanId}:`);
  console.log(`  title: ${weekly.title}`);
  console.log(`  start_value: ${weekly.start_value}, target_value: ${weekly.target_value}, current_value: ${weekly.current_value}`);
  console.log(`  contribute_to_score: ${weekly.contribute_to_score}, contribute_to_value: ${weekly.contribute_to_value}`);
  console.log(`  metricDefinition: ${metric ? JSON.stringify({ id: metric.id, name: metric.name, value_based_progress: metric.value_based_progress }) : 'NULL'}`);
  console.log(`  isValueBased: ${isValueBased}`);

  // Get ALL dailies (no filter)
  const allDailies = await prisma.dailyPlan.findMany({
    where: { weekly_plan_id: weeklyPlanId },
  });

  console.log(`\nAll dailies for weekly plan ${weeklyPlanId}: ${allDailies.length}`);
  for (const d of allDailies) {
    console.log(`  - id=${d.id} "${d.title}": current=${d.current_value}, target=${d.target_value}, progress=${d.progress_pct}, contribute_score=${d.contribute_to_score}, contribute_value=${d.contribute_to_value}`);
  }

  // Filter like the rollup does
  const contributing = allDailies.filter((d: any) => d.contribute_to_score || d.contribute_to_value);
  console.log(`\nContributing dailies: ${contributing.length}`);

  if (isValueBased) {
    let totalValue = new Decimal(0);
    for (const d of contributing) {
      if (d.contribute_to_value) {
        const val = decOrZero(d.current_value);
        console.log(`  + Daily id=${d.id}: contribute_to_value=true, adding ${val}`);
        totalValue = totalValue.add(val);
      }
    }

    const start = decOrZero(weekly.start_value);
    const target = decOrZero(weekly.target_value);
    const current = totalValue;
    let progress = target.sub(start).gt(0)
      ? clampPercent(current.sub(start).div(target.sub(start)).mul(100))
      : new Decimal(0);

    console.log(`\nVALUE-BASED RESULT:`);
    console.log(`  totalValue (should be current_value): ${totalValue}`);
    console.log(`  progress: ${progress}%`);
    console.log(`  EXPECTED: current_value=50000, progress_pct=50`);
    console.log(`  ACTUAL DB: current_value=${weekly.current_value}, progress_pct=${weekly.progress_pct}`);

    // Now actually do the update!
    console.log(`\n>>> Performing UPDATE on weekly plan ${weeklyPlanId}...`);
    const updated = await prisma.weeklyPlan.update({
      where: { id: weeklyPlanId },
      data: {
        progress_pct: progress,
        current_value: current,
      },
    });
    console.log(`>>> UPDATED! new current_value=${updated.current_value}, progress_pct=${updated.progress_pct}`);
  }
}

testRollup()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
