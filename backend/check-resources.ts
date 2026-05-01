import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const resources = await prisma.appResource.findMany();
  console.log("Resources in DB:", resources.map(r => r.code));
  
  const bankResource = resources.find(r => r.code === 'BANK');
  if (bankResource) {
    const permissions = await prisma.appPermission.findMany({
      where: { resource_id: bankResource.id }
    });
    console.log("Permissions for BANK resource:", permissions.length);
    // Let's check permissions for a specific role if we can find one.
    const roles = await prisma.appRole.findMany();
    for (const role of roles) {
      const rolePerms = permissions.filter(p => p.role_id === role.id);
      if (rolePerms.length > 0) {
        console.log(`Role: ${role.name} has BANK perms:`, rolePerms.map(p => p.action));
      }
    }
  } else {
    console.log("BANK resource NOT FOUND in DB!");
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
