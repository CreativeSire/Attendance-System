import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Hash password
  const hash = async (pw: string) => bcrypt.hash(pw, 10);

  // Upsert users
  const admin = await prisma.user.upsert({
    where: { email: 'admin@dala.com' },
    update: {},
    create: {
      name: 'Admin User', email: 'admin@dala.com',
      password: await hash('admin123'), role: 'admin',
      employeeId: 'EMP001', position: 'System Administrator',
      department: 'Management', hourlyRate: 5000, basicSalary: 800000,
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: 'sarah@dala.com' },
    update: {},
    create: {
      name: 'Sarah Manager', email: 'sarah@dala.com',
      password: await hash('password123'), role: 'manager',
      employeeId: 'EMP002', position: 'Operations Manager',
      department: 'Operations', hourlyRate: 2500, basicSalary: 400000,
    },
  });

  const amaka = await prisma.user.upsert({
    where: { email: 'amaka@dala.com' },
    update: {},
    create: {
      name: 'Amaka Obi', email: 'amaka@dala.com',
      password: await hash('password123'), role: 'employee',
      employeeId: 'EMP003', position: 'Software Engineer',
      department: 'Engineering', hourlyRate: 1875, basicSalary: 300000,
    },
  });

  const chidi = await prisma.user.upsert({
    where: { email: 'chidi@dala.com' },
    update: {},
    create: {
      name: 'Chidi Eze', email: 'chidi@dala.com',
      password: await hash('password123'), role: 'employee',
      employeeId: 'EMP004', position: 'Sales Executive',
      department: 'Sales', hourlyRate: 1562, basicSalary: 250000,
    },
  });

  const fatima = await prisma.user.upsert({
    where: { email: 'fatima@dala.com' },
    update: {},
    create: {
      name: 'Fatima Yusuf', email: 'fatima@dala.com',
      password: await hash('password123'), role: 'employee',
      employeeId: 'EMP005', position: 'Marketing Analyst',
      department: 'Marketing', hourlyRate: 1562, basicSalary: 250000,
    },
  });

  // Entry points
  const door1 = await prisma.entryPoint.upsert({
    where: { id: 'ep-main' },
    update: {},
    create: { id: 'ep-main', name: 'Main Entrance', location: 'Front of building', isActive: true },
  });

  await prisma.entryPoint.upsert({
    where: { id: 'ep-side' },
    update: {},
    create: { id: 'ep-side', name: 'Side Entrance', location: 'West wing', isActive: true },
  });

  const office = await prisma.officeLocation.upsert({
    where: { id: 'dala-hq' },
    update: {},
    create: {
      id: 'dala-hq',
      name: 'Dala HQ',
      address: 'Lagos, Nigeria',
      latitude: 6.5244,
      longitude: 3.3792,
      radiusMeters: 75,
      isActive: true,
    },
  });

  await prisma.appConfig.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      defaultOfficeId: office.id,
      workStartTime: '09:00',
      gracePeriodMinutes: 10,
      qrExpirySeconds: 180,
      requireLocation: true,
      requireFaceCapture: true,
      requireLiveness: true,
      latePenaltyMode: 'track_only',
    },
  });

  // Sample attendance for this month
  const today = new Date();
  const employees = [amaka, chidi, fatima, manager];

  for (let d = 1; d <= today.getDate(); d++) {
    const date = new Date(today.getFullYear(), today.getMonth(), d);
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0) continue; // skip Sunday

    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    for (const emp of employees) {
      const existing = await prisma.attendanceRecord.findFirst({ where: { userId: emp.id, date: dateStr } });
      if (existing) continue;

      const isLate = Math.random() > 0.85;
      const lateMinutes = isLate ? Math.floor(Math.random() * 45) + 5 : 0;
      const clockInHour = 9;
      const clockInMinute = isLate ? lateMinutes : Math.floor(Math.random() * 9);
      const clockIn = new Date(date);
      clockIn.setHours(clockInHour, clockInMinute, 0);

      const clockOut = new Date(clockIn);
      clockOut.setHours(17 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60), 0);

      const totalHours = (clockOut.getTime() - clockIn.getTime()) / 3600000;
      const overtimeHours = Math.max(0, totalHours - 8);

      if (d < today.getDate()) {
        await prisma.attendanceRecord.create({
          data: {
            userId: emp.id, date: dateStr,
            clockInTime: clockIn, clockOutTime: clockOut,
            clockInMethod: 'qr', clockOutMethod: 'qr',
            status: isLate ? 'late' : 'present',
            isLate, lateMinutes, totalHours, overtimeHours,
            entryPoint: door1.name, mood: ['happy', 'neutral', 'focused'][Math.floor(Math.random() * 3)],
          },
        });
      }
    }
  }

  // Performance goals
  const q = Math.ceil((today.getMonth() + 1) / 3);
  for (const emp of [amaka, chidi, fatima]) {
    const existing = await prisma.performanceGoal.findFirst({ where: { userId: emp.id, quarter: q, year: today.getFullYear() } });
    if (!existing) {
      await prisma.performanceGoal.create({
        data: {
          userId: emp.id, quarter: q, year: today.getFullYear(),
          objective: `Q${q} ${today.getFullYear()} Key Objective`,
          keyResultOne: 'Complete assigned projects on time',
          keyResultTwo: 'Maintain 95% attendance rate',
          keyResultThree: 'Submit daily BDD check-ins consistently',
          progressPercent: Math.floor(Math.random() * 60) + 20,
        },
      });
    }
  }

  console.log('✅ Seed complete!');
  console.log('\n📋 Demo credentials:');
  console.log('  Admin:    admin@dala.com    / admin123');
  console.log('  Manager:  sarah@dala.com    / password123');
  console.log('  Employee: amaka@dala.com    / password123');
  console.log('  Employee: chidi@dala.com    / password123');
  console.log('  Employee: fatima@dala.com   / password123\n');
}

main().catch(console.error).finally(() => prisma.$disconnect());
