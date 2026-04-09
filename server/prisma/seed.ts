import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Hash password
  const hash = async (pw: string) => bcrypt.hash(pw, 10);
  const hashPin = async (pin: string) => bcrypt.hash(pin, 10);
  const demoFaceImage = (label: string) =>
    `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
        <rect width="512" height="512" rx="40" fill="#16162a"/>
        <circle cx="256" cy="196" r="88" fill="#7c6bff"/>
        <path d="M128 420c28-70 80-112 128-112s100 42 128 112" fill="#8f80ff"/>
        <text x="256" y="474" text-anchor="middle" font-size="28" fill="#ffffff" font-family="Arial, sans-serif">${label}</text>
      </svg>
    `)}`;

  // Upsert users
  const admin = await prisma.user.upsert({
    where: { email: 'admin@dala.com' },
    update: {
      name: 'Admin User',
      password: await hash('admin123'),
      role: 'admin',
      employeeId: 'EMP001',
      position: 'System Administrator',
      department: 'Management',
      hourlyRate: 5000,
      basicSalary: 800000,
      pinHash: await hashPin('1111'),
      isActive: true,
    },
    create: {
      name: 'Admin User', email: 'admin@dala.com',
      password: await hash('admin123'), role: 'admin',
      employeeId: 'EMP001', position: 'System Administrator',
      department: 'Management', hourlyRate: 5000, basicSalary: 800000,
      pinHash: await hashPin('1111'),
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: 'sarah@dala.com' },
    update: {
      name: 'Sarah Manager',
      password: await hash('password123'),
      role: 'manager',
      employeeId: 'EMP002',
      position: 'Operations Manager',
      department: 'Operations',
      hourlyRate: 2500,
      basicSalary: 400000,
      pinHash: await hashPin('2222'),
      isActive: true,
    },
    create: {
      name: 'Sarah Manager', email: 'sarah@dala.com',
      password: await hash('password123'), role: 'manager',
      employeeId: 'EMP002', position: 'Operations Manager',
      department: 'Operations', hourlyRate: 2500, basicSalary: 400000,
      pinHash: await hashPin('2222'),
    },
  });

  const amaka = await prisma.user.upsert({
    where: { email: 'amaka@dala.com' },
    update: {
      name: 'Amaka Obi',
      password: await hash('password123'),
      role: 'employee',
      employeeId: 'EMP003',
      position: 'Software Engineer',
      department: 'Engineering',
      hourlyRate: 1875,
      basicSalary: 300000,
      pinHash: await hashPin('3333'),
      isActive: true,
    },
    create: {
      name: 'Amaka Obi', email: 'amaka@dala.com',
      password: await hash('password123'), role: 'employee',
      employeeId: 'EMP003', position: 'Software Engineer',
      department: 'Engineering', hourlyRate: 1875, basicSalary: 300000,
      pinHash: await hashPin('3333'),
    },
  });

  const chidi = await prisma.user.upsert({
    where: { email: 'chidi@dala.com' },
    update: {
      name: 'Chidi Eze',
      password: await hash('password123'),
      role: 'employee',
      employeeId: 'EMP004',
      position: 'Sales Executive',
      department: 'Sales',
      hourlyRate: 1562,
      basicSalary: 250000,
      pinHash: await hashPin('4444'),
      isActive: true,
    },
    create: {
      name: 'Chidi Eze', email: 'chidi@dala.com',
      password: await hash('password123'), role: 'employee',
      employeeId: 'EMP004', position: 'Sales Executive',
      department: 'Sales', hourlyRate: 1562, basicSalary: 250000,
      pinHash: await hashPin('4444'),
    },
  });

  const fatima = await prisma.user.upsert({
    where: { email: 'fatima@dala.com' },
    update: {
      name: 'Fatima Yusuf',
      password: await hash('password123'),
      role: 'employee',
      employeeId: 'EMP005',
      position: 'Marketing Analyst',
      department: 'Marketing',
      hourlyRate: 1562,
      basicSalary: 250000,
      pinHash: await hashPin('5555'),
      isActive: true,
    },
    create: {
      name: 'Fatima Yusuf', email: 'fatima@dala.com',
      password: await hash('password123'), role: 'employee',
      employeeId: 'EMP005', position: 'Marketing Analyst',
      department: 'Marketing', hourlyRate: 1562, basicSalary: 250000,
      pinHash: await hashPin('5555'),
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
    update: {
      defaultOfficeId: office.id,
      workStartTime: '09:00',
      gracePeriodMinutes: 10,
      qrExpirySeconds: 180,
      requireLocation: true,
      requireFaceCapture: true,
      requireLiveness: true,
      requireEmployeePin: true,
      latePenaltyMode: 'track_only',
    },
    create: {
      id: 'default',
      defaultOfficeId: office.id,
      workStartTime: '09:00',
      gracePeriodMinutes: 10,
      qrExpirySeconds: 180,
      requireLocation: true,
      requireFaceCapture: true,
      requireLiveness: true,
      requireEmployeePin: true,
      latePenaltyMode: 'track_only',
    },
  });

  const zones = [
    {
      id: 'zone-entry',
      name: 'Reception Entry Zone',
      type: 'entry_zone' as const,
      centerLat: 6.52445,
      centerLng: 3.37925,
      radiusMeters: 35,
      allowedForAttendance: true,
      riskWeight: 0,
    },
    {
      id: 'zone-work',
      name: 'Main Work Zone',
      type: 'work_zone' as const,
      centerLat: 6.5244,
      centerLng: 3.3792,
      radiusMeters: 75,
      allowedForAttendance: true,
      riskWeight: 5,
    },
    {
      id: 'zone-quarters',
      name: 'Staff Quarters Zone',
      type: 'staff_quarters_zone' as const,
      centerLat: 6.52495,
      centerLng: 3.37965,
      radiusMeters: 55,
      allowedForAttendance: false,
      riskWeight: 35,
    },
  ];

  for (const zone of zones) {
    await prisma.officeZone.upsert({
      where: { id: zone.id },
      update: {
        officeLocationId: office.id,
        name: zone.name,
        type: zone.type,
        centerLat: zone.centerLat,
        centerLng: zone.centerLng,
        radiusMeters: zone.radiusMeters,
        allowedForAttendance: zone.allowedForAttendance,
        riskWeight: zone.riskWeight,
      },
      create: {
        id: zone.id,
        officeLocationId: office.id,
        name: zone.name,
        type: zone.type,
        centerLat: zone.centerLat,
        centerLng: zone.centerLng,
        radiusMeters: zone.radiusMeters,
        allowedForAttendance: zone.allowedForAttendance,
        riskWeight: zone.riskWeight,
      },
    });
  }

  const enrollmentBlueprints = [
    {
      userId: admin.id,
      appearanceMetadata: { usuallyWearsGlasses: false, facialHairCommon: true, headwearCommon: false },
      label: 'Admin',
    },
    {
      userId: manager.id,
      appearanceMetadata: { usuallyWearsGlasses: true, facialHairCommon: false, headwearCommon: false },
      label: 'Sarah',
    },
    {
      userId: amaka.id,
      appearanceMetadata: { usuallyWearsGlasses: false, facialHairCommon: false, headwearCommon: false },
      label: 'Amaka',
    },
    {
      userId: chidi.id,
      appearanceMetadata: { usuallyWearsGlasses: false, facialHairCommon: true, headwearCommon: false },
      label: 'Chidi',
    },
    {
      userId: fatima.id,
      appearanceMetadata: { usuallyWearsGlasses: true, facialHairCommon: false, headwearCommon: true },
      label: 'Fatima',
    },
  ];

  for (const [index, blueprint] of enrollmentBlueprints.entries()) {
    const version = 1;
    const enrollment = await prisma.faceEnrollment.upsert({
      where: { id: `face-enrollment-${index + 1}` },
      update: {
        userId: blueprint.userId,
        version,
        isActive: true,
        qualityScore: 0.9,
        appearanceMetadata: blueprint.appearanceMetadata,
      },
      create: {
        id: `face-enrollment-${index + 1}`,
        userId: blueprint.userId,
        version,
        isActive: true,
        qualityScore: 0.9,
        appearanceMetadata: blueprint.appearanceMetadata,
      },
    });

    const images = [
      { kind: 'frontal', imageRef: demoFaceImage(`${blueprint.label} front`), qualityScore: 0.92 },
      { kind: 'slight_left', imageRef: demoFaceImage(`${blueprint.label} left`), qualityScore: 0.9 },
      { kind: 'slight_right', imageRef: demoFaceImage(`${blueprint.label} right`), qualityScore: 0.9 },
      { kind: 'neutral', imageRef: demoFaceImage(`${blueprint.label} neutral`), qualityScore: 0.88 },
      { kind: 'glasses_optional', imageRef: demoFaceImage(`${blueprint.label} glasses`), qualityScore: 0.86 },
    ];

    for (const image of images) {
      await prisma.faceEnrollmentImage.upsert({
        where: { id: `${enrollment.id}-${image.kind}` },
        update: image,
        create: {
          id: `${enrollment.id}-${image.kind}`,
          enrollmentId: enrollment.id,
          ...image,
        },
      });
    }

    await prisma.user.update({
      where: { id: blueprint.userId },
      data: {
        masterPhoto: demoFaceImage(`${blueprint.label} avatar`),
        appearanceProfile: blueprint.appearanceMetadata,
      },
    });
  }

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
  console.log('🔐 Demo PINs:');
  console.log('  Admin:    1111');
  console.log('  Manager:  2222');
  console.log('  Amaka:    3333');
  console.log('  Chidi:    4444');
  console.log('  Fatima:   5555\n');
}

main().catch(console.error).finally(() => prisma.$disconnect());
