import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { verifyToken, requireRole } from '../middleware/auth';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { z } from 'zod';

const router = Router();
router.use(verifyToken);
router.use(requireRole('admin', 'manager'));

// GET /api/admin/dashboard
router.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const today = format(new Date(), 'yyyy-MM-dd');
    const now = new Date();
    const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd');

    const [
      totalEmployees,
      todayRecords,
      pendingLeaves,
      pendingExpenses,
      pendingCorrections,
      activeBroadcasts,
      recentActivity,
    ] = await Promise.all([
      prisma.user.count({ where: { isActive: true, role: 'employee' } }),
      prisma.attendanceRecord.findMany({
        where: { date: today },
        include: { user: { select: { name: true, department: true, masterPhoto: true } } },
        orderBy: { clockInTime: 'desc' },
      }),
      prisma.leaveRequest.count({ where: { status: 'pending' } }),
      prisma.expenseRequest.count({ where: { status: 'pending' } }),
      prisma.correctionRequest.count({ where: { status: 'pending' } }),
      prisma.broadcastMessage.count({
        where: { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      }),
      prisma.attendanceRecord.findMany({
        where: { date: today },
        include: { user: { select: { name: true } } },
        orderBy: { clockInTime: 'desc' },
        take: 10,
      }),
    ]);

    const presentCount = todayRecords.filter(r => r.clockInTime).length;
    const lateCount = todayRecords.filter(r => r.isLate).length;
    const clockedOutCount = todayRecords.filter(r => r.clockOutTime).length;

    // Get BDD completion for today
    const bddToday = await prisma.bDDCheckIn.count({ where: { date: today } });

    // Weekly attendance data (last 6 days)
    const weeklyData: Array<{ day: string; present: number; late: number; absent: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = format(d, 'yyyy-MM-dd');
      const dayName = format(d, 'EEE');
      const records = await prisma.attendanceRecord.findMany({ where: { date: dateStr } });
      weeklyData.push({
        day: dayName,
        present: records.filter(r => r.clockInTime && !r.isLate).length,
        late: records.filter(r => r.isLate).length,
        absent: Math.max(0, totalEmployees - records.filter(r => r.clockInTime).length),
      });
    }

    res.json({
      success: true,
      data: {
        todayStats: {
          present: presentCount - lateCount,
          late: lateCount,
          absent: Math.max(0, totalEmployees - presentCount),
          onLeave: 0,
          total: totalEmployees,
        },
        liveFeed: todayRecords.map((r) => ({
          id: r.id,
          userId: r.userId,
          user: r.user,
          date: r.date,
          clockIn: r.clockInTime,
          clockOut: r.clockOutTime,
          status: (r.isLate ? 'LATE' : 'PRESENT'),
          entryPoint: r.entryPoint ? { name: r.entryPoint } : null,
          mood: r.mood,
        })),
        pendingLeaves,
        pendingExpenses,
        pendingCorrections,
        broadcasts: [],
        weeklyChart: weeklyData,
        bddCompletionRate: totalEmployees > 0 ? Math.round((bddToday / totalEmployees) * 100) : 0,
        stats: {
          totalEmployees,
          presentToday: presentCount,
          lateToday: lateCount,
          absentToday: Math.max(0, totalEmployees - presentCount),
          clockedOut: clockedOutCount,
          bddSubmittedToday: bddToday,
        },
        pendingApprovals: {
          leaves: pendingLeaves,
          expenses: pendingExpenses,
          corrections: pendingCorrections,
          total: pendingLeaves + pendingExpenses + pendingCorrections,
        },
        activeBroadcasts,
        liveToday: todayRecords.map(r => ({
          userId: r.userId,
          userName: r.user.name,
          department: r.user.department,
          photo: r.user.masterPhoto,
          clockInTime: r.clockInTime,
          clockOutTime: r.clockOutTime,
          isLate: r.isLate,
          lateMinutes: r.lateMinutes,
          entryPoint: r.entryPoint,
          mood: r.mood,
          workMode: r.workMode,
        })),
        weeklyData,
      },
    });
  } catch (err) { next(err); }
});

router.get('/settings', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [appConfig, officeLocations] = await Promise.all([
      prisma.appConfig.upsert({
        where: { id: 'default' },
        update: {},
        create: { id: 'default' },
      }),
      prisma.officeLocation.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    res.json({ success: true, data: { appConfig, officeLocations } });
  } catch (err) { next(err); }
});

router.patch('/settings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = z.object({
      workStartTime: z.string().optional(),
      gracePeriodMinutes: z.number().int().min(0).max(120).optional(),
      qrExpirySeconds: z.number().int().min(60).max(900).optional(),
      requireLocation: z.boolean().optional(),
      requireFaceCapture: z.boolean().optional(),
      requireLiveness: z.boolean().optional(),
      latePenaltyMode: z.string().optional(),
      office: z.object({
        id: z.string().optional(),
        name: z.string(),
        address: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        radiusMeters: z.number().int().min(10).max(500),
      }).optional(),
    }).parse(req.body);

    const appConfig = await prisma.appConfig.upsert({
      where: { id: 'default' },
      update: {
        ...(payload.workStartTime ? { workStartTime: payload.workStartTime } : {}),
        ...(payload.gracePeriodMinutes !== undefined ? { gracePeriodMinutes: payload.gracePeriodMinutes } : {}),
        ...(payload.qrExpirySeconds !== undefined ? { qrExpirySeconds: payload.qrExpirySeconds } : {}),
        ...(payload.requireLocation !== undefined ? { requireLocation: payload.requireLocation } : {}),
        ...(payload.requireFaceCapture !== undefined ? { requireFaceCapture: payload.requireFaceCapture } : {}),
        ...(payload.requireLiveness !== undefined ? { requireLiveness: payload.requireLiveness } : {}),
        ...(payload.latePenaltyMode ? { latePenaltyMode: payload.latePenaltyMode } : {}),
      },
      create: {
        id: 'default',
        ...(payload.workStartTime ? { workStartTime: payload.workStartTime } : {}),
        ...(payload.gracePeriodMinutes !== undefined ? { gracePeriodMinutes: payload.gracePeriodMinutes } : {}),
        ...(payload.qrExpirySeconds !== undefined ? { qrExpirySeconds: payload.qrExpirySeconds } : {}),
        ...(payload.requireLocation !== undefined ? { requireLocation: payload.requireLocation } : {}),
        ...(payload.requireFaceCapture !== undefined ? { requireFaceCapture: payload.requireFaceCapture } : {}),
        ...(payload.requireLiveness !== undefined ? { requireLiveness: payload.requireLiveness } : {}),
        ...(payload.latePenaltyMode ? { latePenaltyMode: payload.latePenaltyMode } : {}),
      },
    });

    let office: Awaited<ReturnType<typeof prisma.officeLocation.upsert>> | null = null;
    if (payload.office) {
      office = await prisma.officeLocation.upsert({
        where: { id: payload.office.id || 'dala-hq' },
        update: payload.office,
        create: {
          id: payload.office.id || 'dala-hq',
          ...payload.office,
        },
      });
    }

    res.json({ success: true, data: { appConfig, office }, message: 'Settings updated' });
  } catch (err) { next(err); }
});

router.get('/audit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit } = req.query as Record<string, string>;
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit ? parseInt(limit, 10) : 100,
    });

    res.json({ success: true, data: logs });
  } catch (err) { next(err); }
});

// GET /api/admin/reports/attendance
router.get('/reports/attendance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate, department, userId } = req.query as Record<string, string>;

    const where: Record<string, unknown> = {};
    if (startDate && endDate) {
      where.date = { gte: startDate, lte: endDate };
    }
    if (userId) where.userId = userId;
    if (department) {
      where.user = { department };
    }

    const records = await prisma.attendanceRecord.findMany({
      where,
      include: { user: { select: { name: true, department: true, employeeId: true } } },
      orderBy: [{ date: 'desc' }, { clockInTime: 'desc' }],
    });

    const summary = {
      total: records.length,
      present: records.filter(r => r.clockInTime).length,
      late: records.filter(r => r.isLate).length,
      totalHours: records.reduce((sum, r) => sum + (r.totalHours || 0), 0),
      overtimeHours: records.reduce((sum, r) => sum + (r.overtimeHours || 0), 0),
    };

    res.json({ success: true, data: { records, summary } });
  } catch (err) { next(err); }
});

// GET /api/admin/corrections
router.get('/corrections', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const corrections = await prisma.correctionRequest.findMany({
      where: { status: 'pending' },
      include: {
        record: { include: { user: { select: { name: true, employeeId: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: corrections });
  } catch (err) { next(err); }
});

// PATCH /api/admin/corrections/:id
router.patch('/corrections/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, reviewNote } = req.body;
    const correction = await prisma.correctionRequest.update({
      where: { id: req.params.id as string },
      data: { status, reviewNote, reviewedBy: (req as Request & { user?: { id: string } }).user?.id },
    });
    res.json({ success: true, data: correction });
  } catch (err) { next(err); }
});

export default router;
