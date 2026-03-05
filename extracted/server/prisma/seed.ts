const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: 'admin@dala.ng' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'admin@dala.ng',
      role: 'admin',
      department: 'Management',
      employeeId: 'DALA001',
      hourlyRate: 100,
      officeLat: 6.5244,
      officeLng: 3.3792,
      officeRadius: 20,
      officeAddress: 'Dala Office, Lagos'
    },
  });

  console.log({ admin });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
