
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Get latest user
  const user = await prisma.appUser.findFirst({
    orderBy: { created_at: "desc" },
    include: { role: true, company: true }
  });

  if (!user) {
    console.log("No users found.");
    return;
  }

  console.log(`Checking user: ${user.email} (ID: ${user.id})`);
  console.log(`Company: ${user.company.name} (Code: ${user.company.company_code})`);
  console.log(`Role: ${user.role.name} (ID: ${user.role.id})`);

  // Check permissions
  const permissions = await prisma.appPermission.findMany({
    where: { role_id: user.role.id },
    include: { resource: true }
  });

  console.log(`\nPermissions for Role ID ${user.role.id}:`);
  permissions.forEach(p => {
    console.log(` - ${p.resource.name} (${p.resource.code}): ${p.action}`);
  });

  const bankPerm = permissions.find(p => p.resource.name === "BANK" && p.action === "read:any");
  if (bankPerm) {
    console.log("\n✅ SUCCESS: Has read:any on BANK");
  } else {
    console.log("\n❌ FAILURE: Missing read:any on BANK");
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
