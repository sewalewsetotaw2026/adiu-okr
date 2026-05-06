import { PrismaClient } from '@prisma/client';
import * as okrRollup from '../src/services/okrRollupService';

const prisma = new PrismaClient();

async function main() {
  console.log('[Recalculate] Starting full score recalculation...');

  // Get all KRs
  const krs = await prisma.employeeKeyResult.findMany({
    select: { id: true, title: true, employee_objective_id: true }
  });

  console.log(`[Recalculate] Found ${krs.length} KRs`);

  // Recalculate each KR score
  for (const kr of krs) {
    try {
      await (okrRollup as any).computeEmployeeKRScore(kr.id, prisma);
      console.log(`[Recalculate] Recalculated KR ${kr.id} (${kr.title})`);
    } catch(e: any) {
      console.error(`[Recalculate] Error recalculating KR ${kr.id}:`, e.message);
    }
  }

  // Rollup each objective
  const objectives = await prisma.employeeObjective.findMany({
    select: { id: true, title: true }
  });

  for (const obj of objectives) {
    try {
      await (okrRollup as any).rollupEmployeeObjective(obj.id, prisma, false);
      console.log(`[Recalculate] Rolled up objective ${obj.id} (${obj.title})`);
    } catch(e: any) {
      console.error(`[Recalculate] Error rolling up objective ${obj.id}:`, e.message);
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
