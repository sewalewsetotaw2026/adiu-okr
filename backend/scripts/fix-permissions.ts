import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Fixing permissions...");

  const resources = [
    { code: "COMPANY", name: "Company Management" },
    { code: "SETTINGS", name: "System Settings" },
  ];

  for (const res of resources) {
    const resource = await prisma.appResource.upsert({
      where: { code: res.code },
      update: {},
      create: {
        code: res.code,
        name: res.name,
      },
    });
    console.log(`Ensured resource exists: ${resource.code}`);
  }

  const employeeRole = await prisma.appRole.findFirst({
    where: { name: "Employee" },
  });

  if (!employeeRole) {
    console.error("Employee role not found!");
    return;
  }

  const resourcesToGrant = ["COMPANY", "SETTINGS"];
  const actions = ["read:any", "create:any"];

  for (const resCode of resourcesToGrant) {
    const resource = await prisma.appResource.findUnique({
      where: { code: resCode },
    });

    if (!resource) continue;

    for (const action of actions) {
      await prisma.appPermission.upsert({
        where: {
          role_id_resource_id_action: {
            role_id: employeeRole.id,
            resource_id: resource.id,
            action: action,
          },
        },
        update: {},
        create: {
          role_id: employeeRole.id,
          resource_id: resource.id,
          action: action,
        },
      });
      console.log(`Granted ${action} on ${resCode} to Employee role`);
    }
  }

  console.log("Permissions fix complete.");
}

main()
  .catch((e) => {
    console.error(e);
    throw e;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
