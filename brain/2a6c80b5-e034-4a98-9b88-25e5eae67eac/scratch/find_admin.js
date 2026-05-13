const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.appUser.findFirst({
    where: { role: { in: ['Admin', 'Super Admin'] } },
    select: { email: true }
  });
  console.log('Admin Email:', admin?.email);
}

main().catch(console.error).finally(() => prisma.$disconnect());
