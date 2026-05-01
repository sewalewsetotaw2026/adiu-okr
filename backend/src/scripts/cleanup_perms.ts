
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Cleaning up redundant permissions...");

  const permissions = await prisma.appPermission.findMany({
    include: { resource: true }
  });

  const seen = new Map<string, number>();
  const toDelete: number[] = [];

  for (const p of permissions) {
    const actionType = p.action.split(':')[0];
    const key = `${p.role_id}-${p.resource_id}-${actionType}`;

    // Simple hierarchy weight: any > team > own
    const scope = p.action.split(':')[1] || 'any';
    const weights: Record<string, number> = { any: 3, team: 2, own: 1 };
    const weight = weights[scope] || 0;

    if (seen.has(key)) {
      const existingId = seen.get(key)!;
      const existingPerm = permissions.find(prev => prev.id === existingId)!;
      const existingScope = existingPerm.action.split(':')[1] || 'any';
      const existingWeight = weights[existingScope] || 0;

      if (weight > existingWeight) {
        // New is stronger, delete old
        toDelete.push(existingId);
        seen.set(key, p.id);
      } else {
        // New is weaker or equal, delete new
        toDelete.push(p.id);
      }
    } else {
      seen.set(key, p.id);
    }
  }

  console.log(`Found ${toDelete.length} redundant permissions to delete.`);

  if (toDelete.length > 0) {
    await prisma.appPermission.deleteMany({
      where: { id: { in: toDelete } }
    });
    console.log("Cleanup complete.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
