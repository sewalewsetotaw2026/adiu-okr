
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting GLOBAL READ permission repair...");

  // 1. Get all Resources
  const allResources = await prisma.appResource.findMany();

  // 2. Define Global Read Resources
  const globalResourceNames = ["BANK", "EDUCATION_LEVEL", "FIELD_OF_STUDY", "INSTITUTION", "ALLOWANCE_TYPE"];
  const globalResources = allResources.filter(r => globalResourceNames.includes(r.name));

  // 3. Find all "Employee" and "HR" roles
  const targetRoles = await prisma.appRole.findMany({
    where: {
      name: { in: ["Employee", "HR"] }
    }
  });

  console.log(`Found ${targetRoles.length} roles to fix.`);

  for (const role of targetRoles) {
    console.log(`Fixing permissions for Role: ${role.name} (ID: ${role.id}, Company: ${role.company_id})`);

    for (const resource of globalResources) {
      // Grant read:any
      const action = "read:any";

      const exists = await prisma.appPermission.findFirst({
        where: {
          role_id: role.id,
          resource_id: resource.id,
          action: action
        }
      });

      if (!exists) {
        await prisma.appPermission.create({
          data: {
            role_id: role.id,
            resource_id: resource.id,
            action: action
          }
        });
        // console.log(`  + Granted ${action} on ${resource.name}`);
      }
    }
  }

  console.log("Global Read permission repair complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
