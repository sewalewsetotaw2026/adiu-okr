import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting MASTER PERMISSION REPAIR...");

  const allResources = await prisma.appResource.findMany();

  // 1. Basic Employee Resources (Full CRUD Own - refined)
  const selfServiceResourceCodes = [
    "EMERGENCY_CONTACT",
    "EMPLOYEE_ADDRESS",
    "EMPLOYEE_PHONE",
    "EMPLOYEE_EDUCATION",
    "EMPLOYEE_EXPERIENCE",
    "EMPLOYEE_CERTIFICATE",
    "EMPLOYEE_DOCUMENT",
    "FINANCIAL_DETAIL",
    "NOTIFICATION"
  ];
  const selfServiceResources = allResources.filter(r => selfServiceResourceCodes.includes(r.code));

  // 2. Employee Read-Only Resources (Read Own)
  const readOnlyResourceCodes = [
    "CAREER_EVENT",
    "EMPLOYEE",
    "EMPLOYMENT",
    "LEAVE_BALANCE",
    "EMPLOYEE_ALLOWANCE",
    "EMPLOYEE_COST_SHARING",
    "EMPLOYEE_RESIGNATION",
    "USER"
  ];
  const readOnlyResources = allResources.filter(r => readOnlyResourceCodes.includes(r.code));

  // 3. Special Scoped Resources (Limited CRUD)
  // LEAVE_APPLICATION, LEAVE_RECALL, LEAVE_CASH_OUT have specific actions
  const leaveResourceCodes = ["LEAVE_APPLICATION", "LEAVE_RECALL", "LEAVE_CASH_OUT"];
  const leaveResources = allResources.filter(r => leaveResourceCodes.includes(r.code));

  // 4. Global Read Resources (Read Any)
  const globalResourceCodes = [
    "BANK",
    "EDUCATION_LEVEL",
    "FIELD_OF_STUDY",
    "INSTITUTION",
    "ALLOWANCE_TYPE",
    "DEPARTMENT",
    "JOB_TITLE",
    "JOB_LEVEL",
    "PUBLIC_HOLIDAY",
    "CELEBRATION",
    "LEAVE_TYPE",
    "COMPANY",
    "SETTINGS"
  ];
  const globalResources = allResources.filter(r => globalResourceCodes.includes(r.code));

  // Find all "Employee" and "HR" roles
  const targetRoles = await prisma.appRole.findMany({
    where: {
      name: { in: ["Employee", "HR"] }
    }
  });

  console.log(`Found ${targetRoles.length} roles to fix.`);

  for (const role of targetRoles) {
    console.log(`Processing Role: ${role.name} (ID: ${role.id})`);

    // A. Grant Self-Service Permissions (CRUD Own)
    const selfActions = ["read:own", "update:own", "create:own", "delete:own"];
    for (const resource of selfServiceResources) {
      for (const action of selfActions) {
        await prisma.appPermission.upsert({
          where: {
            role_id_resource_id_action: { role_id: role.id, resource_id: resource.id, action }
          },
          update: {},
          create: { role_id: role.id, resource_id: resource.id, action }
        });
      }
    }

    // B. Grant Read-Only/Update Own (Reduced)
    // USER can read/update own
    const userRes = allResources.find(r => r.code === "USER");
    if (userRes) {
      for (const action of ["read:own", "update:own"]) {
        await prisma.appPermission.upsert({
          where: { role_id_resource_id_action: { role_id: role.id, resource_id: userRes.id, action } },
          update: {},
          create: { role_id: role.id, resource_id: userRes.id, action }
        });
      }
    }

    // Others Read Own
    for (const resource of readOnlyResources.filter(r => r.code !== "USER")) {
      await prisma.appPermission.upsert({
        where: { role_id_resource_id_action: { role_id: role.id, resource_id: resource.id, action: "read:own" } },
        update: {},
        create: { role_id: role.id, resource_id: resource.id, action: "read:own" }
      });
    }

    // C. Grant Global Read Permissions (Read Any)
    for (const resource of globalResources) {
      await prisma.appPermission.upsert({
        where: { role_id_resource_id_action: { role_id: role.id, resource_id: resource.id, action: "read:any" } },
        update: {},
        create: { role_id: role.id, resource_id: resource.id, action: "read:any" }
      });
      // LEAVE_TYPE also gets read:own as per user edit
      if (resource.code === "LEAVE_TYPE") {
        await prisma.appPermission.upsert({
          where: { role_id_resource_id_action: { role_id: role.id, resource_id: resource.id, action: "read:own" } },
          update: {},
          create: { role_id: role.id, resource_id: resource.id, action: "read:own" }
        });
      }
    }

    // D. Grant Leave Actions
    for (const resource of leaveResources) {
      const actions = ["read:own", "update:own", "create:own", "read:team", "update:team"];
      if (resource.code === "LEAVE_RECALL") {
        // LEAVE_RECALL only gets these (matching seedData)
        const recallActions = ["read:own", "update:own", "read:team", "update:team"];
        for (const action of recallActions) {
          await prisma.appPermission.upsert({
            where: { role_id_resource_id_action: { role_id: role.id, resource_id: resource.id, action } },
            update: {},
            create: { role_id: role.id, resource_id: resource.id, action }
          });
        }
      } else {
        for (const action of actions) {
          await prisma.appPermission.upsert({
            where: { role_id_resource_id_action: { role_id: role.id, resource_id: resource.id, action } },
            update: {},
            create: { role_id: role.id, resource_id: resource.id, action }
          });
        }
      }
    }

    // E. Grant Global Create Permissions for lookups
    const creationResources = ["COMPANY", "SETTINGS", "JOB_TITLE", "DEPARTMENT", "JOB_LEVEL", "EDUCATION_LEVEL", "FIELD_OF_STUDY", "INSTITUTION"];
    for (const resCode of creationResources) {
      const resource = allResources.find(r => r.code === resCode);
      if (!resource) continue;
      await prisma.appPermission.upsert({
        where: { role_id_resource_id_action: { role_id: role.id, resource_id: resource.id, action: "create:any" } },
        update: {},
        create: { role_id: role.id, resource_id: resource.id, action: "create:any" }
      });
    }
  }

  console.log("Master repair complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
