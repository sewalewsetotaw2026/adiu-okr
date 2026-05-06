const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('[Rollup] Starting full rollup...');

  // Get all objectives
  const objectives = await prisma.employeeObjective.findMany({
    select: { id: true, title: true }
  });

  console.log(`[Rollup] Found ${objectives.length} objectives`);

  for (const obj of objectives) {
    try {
      // Get KRs for this objective
      const krs = await prisma.employeeKeyResult.findMany({
        where: { employee_objective_id: obj.id },
        select: { id: true, title: true }
      });

      console.log(`[Rollup] Objective ${obj.id} (${obj.title}) has ${krs.length} KRs`);

      // Recalculate each KR score first
      for (const kr of krs) {
        try {
          // Call the rollup service - we need to import it properly
          // For now, just update the KR's final_score from its progress updates or plans
          const progressUpdates = await prisma.progressUpdate.findMany({
            where: { employee_kr_id: kr.id },
            orderBy: { created_at: 'desc' },
            take: 1
          });

          if (progressUpdates.length > 0) {
            const pu = progressUpdates[0];
            await prisma.employeeKeyResult.update({
              where: { id: kr.id },
              data: {
                final_score: pu.progress_percent ? parseFloat(pu.progress_percent.toString()) : null,
                final_value: pu.current_value
              }
            });
            console.log(`[Rollup] Updated KR ${kr.id} (${kr.title}) final_score: ${pu.progress_percent}`);
          }
        } catch(e) {
          console.error(`[Rollup] Error updating KR ${kr.id}:`, e.message);
        }
      }

      // Now rollup the objective
      const updatedKRs = await prisma.employeeKeyResult.findMany({
        where: { employee_objective_id: obj.id },
        select: { final_score: true, weight_percent: true }
      });

      const scores = updatedKRs
        .filter(kr => kr.final_score !== null)
        .map(kr => parseFloat(kr.final_score.toString()));

      if (scores.length > 0) {
        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        await prisma.employeeObjective.update({
          where: { id: obj.id },
          data: { final_score: avgScore }
        });
        console.log(`[Rollup] Updated objective ${obj.id} final_score: ${avgScore}`);
      }
    } catch(e) {
      console.error(`[Rollup] Error processing objective ${obj.id}:`, e.message);
    }
  }

  console.log('[Rollup] Done!');
  await prisma.$disconnect();
}

main().catch(e => { console.error('[Rollup] Fatal error:', e); process.exit(1); });
