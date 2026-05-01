
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Auditing Admin Permissions...");

  const adminRole = await prisma.appRole.findFirst({
    where: { name: "Admin" }
  });

  if (!adminRole) {
    console.log("Admin role not found.");
    return;
  }

  console.log(`Found Admin Role (ID: ${adminRole.id})`);

  const permissions = await prisma.appPermission.findMany({
    where: { role_id: adminRole.id },
    include: { resource: true }
  });

  console.log(`\nPermissions for Admin Role:`);
  permissions.forEach(p => {
    console.log(`- ${p.resource.name} (${p.resource.code}): ${p.action}`);
  });

  // Specifically check for duplicates or multiple scopes for the same action
  const groups: Record<string, string[]> = {};
  permissions.forEach(p => {
    const key = `${p.resource.code}:${p.action.split(':')[0]}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(p.action.split(':')[1] || 'any');
  });

  console.log("\nAction Groups with multiple scopes:");
  Object.entries(groups).forEach(([key, scopes]) => {
    if (scopes.length > 1) {
      console.log(`${key}: ${scopes.join(", ")}`);
    }
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
