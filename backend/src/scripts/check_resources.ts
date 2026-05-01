
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const resources = await prisma.appResource.findMany();
  console.log("App Resources:");
  resources.forEach(r => console.log(`${r.id}: ${r.name} (Code: ${r.code})`));

  const roleId = 10;
  const count = await prisma.appPermission.count({ where: { role_id: roleId } });
  console.log(`\nPermissions count for Role 10: ${count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
