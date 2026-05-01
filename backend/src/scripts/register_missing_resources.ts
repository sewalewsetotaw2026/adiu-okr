
import { PrismaClient } from '@prisma/client';
import { Resources, Actions, Scopes, ActionTypes } from '../utils/constants';

const prisma = new PrismaClient();

async function syncResources() {
  console.log("--- Syncing Missing Resources to Database ---");

  // 1. Get all resources defined in Constants
  const resourceCodes = Object.values(Resources);

  // 2. Ensure each resource exists in DB
  for (const code of resourceCodes) {
    const name = code.split('_').map(word => word.charAt(0) + word.slice(1).toLowerCase()).join(' ') + " Management";

    const resource = await prisma.appResource.upsert({
      where: { code },
      update: {},
      create: { code, name }
    });
    console.log(`Log: Ensured resource ${resource.code}`);
  }

  // 3. Grant 'Any' permissions to Admin and HR roles for these new resources
  const privilegedRoles = await prisma.appRole.findMany({
    where: {
      name: { in: ['Admin', 'HR', 'Super Admin'] }
    }
  });

  const allActions = [
    ActionTypes.CREATE_ANY, ActionTypes.READ_ANY, ActionTypes.UPDATE_ANY, ActionTypes.DELETE_ANY,
    ActionTypes.CREATE_OWN, ActionTypes.READ_OWN, ActionTypes.UPDATE_OWN, ActionTypes.DELETE_OWN
  ];

  for (const role of privilegedRoles) {
    for (const code of resourceCodes) {
      const resource = await prisma.appResource.findUnique({ where: { code } });
      if (!resource) continue;

      for (const action of allActions) {
        await prisma.appPermission.upsert({
          where: {
            role_id_resource_id_action: {
              role_id: role.id,
              resource_id: resource.id,
              action: action
            }
          },
          update: {},
          create: {
            role_id: role.id,
            resource_id: resource.id,
            action: action
          }
        });
      }
    }
    console.log(`Log: Granted full permissions to role: ${role.name} (${role.id})`);
  }

  console.log("\n--- Sync Complete ---");
  await prisma.$disconnect();
}

syncResources().catch(console.error);
