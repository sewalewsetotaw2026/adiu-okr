
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting permission repair...");

  // 1. Get all Resources
  const allResources = await prisma.appResource.findMany();

  // 2. Define Employee Permissions (Basic Self-Service)
  const selfServiceResources = ["EMERGENCY_CONTACT", "EMPLOYEE_ADDRESS", "EMPLOYEE_PHONE", "EMPLOYEE_EDUCATION", "EMPLOYEE_EXPERIENCE", "EMPLOYEE_CERTIFICATE", "EMPLOYEE_DOCUMENT", "FINANCIAL_DETAIL", "NOTIFICATION", "LEAVE_APPLICATION", "LEAVE_RECALL", "LEAVE_CASH_OUT", "USER"];
  const readOnlyResources = ["CAREER_EVENT", "EMPLOYEE", "EMPLOYMENT", "LEAVE_BALANCE", "EMPLOYEE_ALLOWANCE", "EMPLOYEE_COST_SHARING", "EMPLOYEE_RESIGNATION"];
  const globalResources = ["BANK", "EDUCATION_LEVEL", "FIELD_OF_STUDY", "INSTITUTION", "ALLOWANCE_TYPE", "DEPARTMENT", "JOB_TITLE", "JOB_LEVEL", "PUBLIC_HOLIDAY", "CELEBRATION", "LEAVE_TYPE", "COMPANY", "SETTINGS"];

  // 3. Find all "Employee" roles across all companies
  const employeeRoles = await prisma.appRole.findMany({
    where: { name: "Employee" }
  });

  console.log(`Found ${employeeRoles.length} Employee roles to fix.`);

  for (const role of employeeRoles) {
    console.log(`Fixing permissions for Role ID: ${role.id} (Company: ${role.company_id})`);

    // A. Grant Self-Service Permissions (CRUD Own)
    for (const resCode of selfServiceResources) {
      const res = allResources.find(r => r.code === resCode);
      if (!res) continue;
      for (const action of ["read:own", "update:own", "create:own", "delete:own"]) {
        await prisma.appPermission.upsert({
          where: {
            role_id_resource_id_action: {
              role_id: role.id,
              resource_id: res.id,
              action
            }
          },
          update: {},
          create: {
            role_id: role.id,
            resource_id: res.id,
            action
          }
        });
      }
    }

    // B. Grant Read-Only Permissions (Read Own)
    for (const resCode of readOnlyResources) {
      const res = allResources.find(r => r.code === resCode);
      if (!res) continue;
      await prisma.appPermission.upsert({
        where: {
          role_id_resource_id_action: {
            role_id: role.id,
            resource_id: res.id,
            action: "read:own"
          }
        },
        update: {},
        create: {
          role_id: role.id,
          resource_id: res.id,
          action: "read:own"
        }
      });
    }

    // C. Grant Global Read Permissions (Read Any)
    for (const resCode of globalResources) {
      const res = allResources.find(r => r.code === resCode);
      if (!res) continue;
      await prisma.appPermission.upsert({
        where: {
          role_id_resource_id_action: {
            role_id: role.id,
            resource_id: res.id,
            action: "read:any"
          }
        },
        update: {},
        create: {
          role_id: role.id,
          resource_id: res.id,
          action: "read:any"
        }
      });
    }

    // D. Grant Global Create Permissions (Create Any) for lookups
    const creationResources = ["COMPANY", "SETTINGS", "JOB_TITLE", "DEPARTMENT", "JOB_LEVEL", "EDUCATION_LEVEL", "FIELD_OF_STUDY", "INSTITUTION"];
    for (const resCode of creationResources) {
      const res = allResources.find(r => r.code === resCode);
      if (!res) continue;
      await prisma.appPermission.upsert({
        where: {
          role_id_resource_id_action: {
            role_id: role.id,
            resource_id: res.id,
            action: "create:any"
          }
        },
        update: {},
        create: {
          role_id: role.id,
          resource_id: res.id,
          action: "create:any"
        }
      });
    }
  }

  console.log("Permission repair complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
