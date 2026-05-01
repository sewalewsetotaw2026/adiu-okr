
import { PrismaClient } from "@prisma/client";
import { employeePermissions, resources, allActions } from "../prisma/seedData";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting permission fix...");

  // 1. Ensure all resources exist in the database
  const existingResources = await prisma.appResource.findMany();
  const resourceCodes = new Set(existingResources.map(r => r.code));
  
  for (const res of resources) {
    if (!resourceCodes.has(res.code)) {
      console.log(`Creating missing resource: ${res.code}`);
      await prisma.appResource.create({
        data: {
          code: res.code,
          name: res.name
        }
      });
    } else {
      // Update name if match by code exists but name is different
      const current = existingResources.find(r => r.code === res.code);
      if (current && current.name !== res.name) {
        console.log(`Updating resource name: ${res.code} -> ${res.name}`);
        await prisma.appResource.update({
          where: { id: current.id },
          data: { name: res.name }
        });
      }
    }
  }

  // Refetch resources to get all IDs
  const allResources = await prisma.appResource.findMany();
  const resourceMap = new Map(allResources.map(r => [r.code, r.id]));

  // 2. Identify all Admin, HR, and Employee roles across all companies
  const allRoles = await prisma.appRole.findMany();
  
  for (const role of allRoles) {
    const roleName = role.name.toLowerCase();
    console.log(`Processing role: ${role.name} (ID: ${role.id}, Company ID: ${role.company_id})`);
    
    if (roleName.includes("admin") || roleName === "hr") {
      // Grant ALL permissions
      console.log(`  Granting full permissions to ${role.name}`);
      const permissions = [];
      for (const res of allResources) {
        for (const action of allActions) {
          permissions.push({
            role_id: role.id,
            resource_id: res.id,
            action: action
          });
        }
      }
      
      await prisma.appPermission.createMany({
        data: permissions,
        skipDuplicates: true
      });
    } else if (roleName === "employee") {
      // Grant Employee permissions
      console.log(`  Granting standard Employee permissions to ${role.name}`);
      const permissions = [];
      for (const perm of employeePermissions) {
        const resourceId = resourceMap.get(perm.resource);
        if (!resourceId) continue;
        
        for (const action of perm.actions) {
          permissions.push({
            role_id: role.id,
            resource_id: resourceId,
            action: action
          });
        }
      }
      
      await prisma.appPermission.createMany({
        data: permissions,
        skipDuplicates: true
      });
    }
  }

  console.log("Permission fix completed successfully.");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
