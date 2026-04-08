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

  const [
    users,
    attendance,
    bddCheckIns,
    leaves,
    expenses,
    goals,
    notifications,
    broadcasts,
    entryPoints,
    officeLocations,
    appConfig,
    auditLogs,
  ] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.attendanceRecord.findMany({ orderBy: [{ date: 'asc' }, { createdAt: 'asc' }] }),
    prisma.bDDCheckIn.findMany({ orderBy: [{ date: 'asc' }, { createdAt: 'asc' }] }),
    prisma.leaveRequest.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.expenseRequest.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.performanceGoal.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.notification.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.broadcastMessage.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.entryPoint.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.officeLocation.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.appConfig.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: 'asc' }, take: 5000 }),
  ]);

  const snapshot = {
    exportedAt: new Date().toISOString(),
    project: 'dala-attendance',
    counts: {
      users: users.length,
      attendance: attendance.length,
      bddCheckIns: bddCheckIns.length,
      leaves: leaves.length,
      expenses: expenses.length,
      goals: goals.length,
      notifications: notifications.length,
      broadcasts: broadcasts.length,
      entryPoints: entryPoints.length,
      officeLocations: officeLocations.length,
      appConfig: appConfig.length,
      auditLogs: auditLogs.length,
    },
    data: {
      users,
      attendance,
      bddCheckIns,
      leaves,
      expenses,
      goals,
      notifications,
      broadcasts,
      entryPoints,
      officeLocations,
      appConfig,
      auditLogs,
    },
  };

  const outputPath = path.join(outputDir, 'full-backup.json');
  await fs.writeFile(outputPath, JSON.stringify(snapshot, null, 2), 'utf8');
  console.log(`Backup exported to ${outputPath}`);
}

main()
  .catch((error) => {
    console.error('Failed to export database backup');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
