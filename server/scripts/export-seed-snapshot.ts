import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function getTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function main() {
  const outputDir = path.resolve(process.cwd(), '../backups', getTimestamp());
  await ensureDir(outputDir);

  const [users, entryPoints, officeLocations, appConfig] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
        role: true,
        employeeId: true,
        position: true,
        department: true,
        hourlyRate: true,
        basicSalary: true,
        phone: true,
        startDate: true,
        isActive: true,
      },
    }),
    prisma.entryPoint.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.officeLocation.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.appConfig.findMany({ orderBy: { createdAt: 'asc' } }),
  ]);

  const snapshot = {
    exportedAt: new Date().toISOString(),
    notes: [
      'This snapshot is intended for environment seeding and recovery.',
      'It intentionally excludes refresh tokens, notifications, and audit logs.',
      'User password hashes are included to preserve current login access in non-production restores.',
    ],
    data: {
      users,
      entryPoints,
      officeLocations,
      appConfig,
    },
  };

  const outputPath = path.join(outputDir, 'seed-snapshot.json');
  await fs.writeFile(outputPath, JSON.stringify(snapshot, null, 2), 'utf8');
  console.log(`Seed snapshot exported to ${outputPath}`);
}

main()
  .catch((error) => {
    console.error('Failed to export seed snapshot');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
