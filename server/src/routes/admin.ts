import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { verifyToken, requireRole } from '../middleware/auth';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { z } from 'zod';
import { assessRisk, buildReviewSummary, resolveLocationAndZone } from '../utils/verification';
import { createAuditLog } from '../utils/audit';

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
      requireEmployeePin: z.boolean().optional(),
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
        ...(payload.requireEmployeePin !== undefined ? { requireEmployeePin: payload.requireEmployeePin } : {}),
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
        ...(payload.requireEmployeePin !== undefined ? { requireEmployeePin: payload.requireEmployeePin } : {}),
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

router.get('/zones', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const zones = await prisma.officeZone.findMany({
      include: { officeLocation: true },
      orderBy: [{ officeLocationId: 'asc' }, { createdAt: 'asc' }],
    });
    res.json({ success: true, data: zones });
  } catch (err) { next(err); }
});

router.post('/zones', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = z.object({
      officeLocationId: z.string(),
      name: z.string().min(1),
      type: z.enum(['entry_zone', 'work_zone', 'staff_quarters_zone', 'admin_zone', 'warehouse_zone', 'restricted_zone']),
      centerLat: z.number(),
      centerLng: z.number(),
      radiusMeters: z.number().int().min(10).max(1000),
      allowedForAttendance: z.boolean().default(true),
      riskWeight: z.number().int().min(0).max(100).default(0),
    }).parse(req.body);

    const zone = await prisma.officeZone.create({ data });
    await createAuditLog({
      actorId: req.user!.id,
      action: 'admin.zone.created',
      entityType: 'office_zone',
      entityId: zone.id,
      metadata: data,
    });

    res.status(201).json({ success: true, data: zone });
  } catch (err) { next(err); }
});

router.patch('/zones/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = z.object({
      name: z.string().min(1).optional(),
      type: z.enum(['entry_zone', 'work_zone', 'staff_quarters_zone', 'admin_zone', 'warehouse_zone', 'restricted_zone']).optional(),
      centerLat: z.number().optional(),
      centerLng: z.number().optional(),
      radiusMeters: z.number().int().min(10).max(1000).optional(),
      allowedForAttendance: z.boolean().optional(),
      riskWeight: z.number().int().min(0).max(100).optional(),
    }).parse(req.body);

    const zone = await prisma.officeZone.update({
      where: { id: req.params.id as string },
      data,
    });

    await createAuditLog({
      actorId: req.user!.id,
      action: 'admin.zone.updated',
      entityType: 'office_zone',
      entityId: zone.id,
      metadata: data,
    });

    res.json({ success: true, data: zone });
  } catch (err) { next(err); }
});

router.get('/review-queue', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.query as Record<string, string>;
    const queue = await prisma.reviewQueueItem.findMany({
      where: status ? { status: status as 'pending' | 'approved' | 'rejected' | 'escalated' } : undefined,
      include: {
        user: { select: { id: true, name: true, employeeId: true, department: true } },
        attendanceVerification: true,
      },
      orderBy: [{ riskScore: 'desc' }, { createdAt: 'desc' }],
    });

    res.json({ success: true, data: queue });
  } catch (err) { next(err); }
});

router.patch('/review-queue/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = z.object({
      status: z.enum(['approved', 'rejected', 'escalated']),
      reviewNote: z.string().optional(),
    }).parse(req.body);

    const queueItem = await prisma.reviewQueueItem.update({
      where: { id: req.params.id as string },
      data: {
        status: data.status,
        reviewNote: data.reviewNote,
        reviewedBy: req.user!.id,
        reviewedAt: new Date(),
      },
    });

    await prisma.attendanceVerification.update({
      where: { id: queueItem.attendanceVerificationId },
      data: { reviewStatus: data.status },
    });

    if (queueItem.attendanceRecordId) {
      await prisma.attendanceRecord.update({
        where: { id: queueItem.attendanceRecordId },
        data: {
          reviewDecision: data.status === 'approved' ? 'approved' : data.status === 'escalated' ? 'flagged' : 'blocked',
        },
      });
    }

    await createAuditLog({
      actorId: req.user!.id,
      action: `admin.review_queue.${data.status}`,
      entityType: 'review_queue_item',
      entityId: queueItem.id,
      metadata: { reviewNote: data.reviewNote },
    });

    res.json({ success: true, data: queueItem });
  } catch (err) { next(err); }
});

router.post('/assisted-clock-in', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = z.object({
      employeeId: z.string(),
      reasonCode: z.string().min(1),
      note: z.string().optional(),
      workMode: z.enum(['office', 'wfh', 'field', 'client_site']).default('office'),
      lat: z.number().optional(),
      lng: z.number().optional(),
      accuracy: z.number().optional(),
    }).parse(req.body);

    const employee = await prisma.user.findUnique({ where: { id: data.employeeId } });
    if (!employee) {
      res.status(404).json({ success: false, message: 'Employee not found' });
      return;
    }

    const today = format(new Date(), 'yyyy-MM-dd');
    const existing = await prisma.attendanceRecord.findFirst({
      where: { userId: employee.id, date: today },
    });

    if (existing) {
      res.status(400).json({ success: false, message: 'Attendance already exists for today.' });
      return;
    }

    const locationResult = await resolveLocationAndZone({
      lat: data.lat,
      lng: data.lng,
      accuracy: data.accuracy,
    });

    const risk = assessRisk({
      pinVerified: false,
      hasEnrollment: Boolean(employee.masterPhoto),
      faceScore: employee.masterPhoto ? 0.7 : 0.4,
      livenessScore: 0.45,
      locationStatus: locationResult.locationStatus,
      zoneType: locationResult.zoneType,
      knownDevice: false,
      lateMinutes: 0,
      previousOverrides: 0,
    });

    const record = await prisma.attendanceRecord.create({
      data: {
        userId: employee.id,
        date: today,
        clockInTime: new Date(),
        clockInMethod: 'admin_override',
        clockInLat: data.lat,
        clockInLng: data.lng,
        clockInAccuracy: data.accuracy,
        locationStatus: locationResult.locationStatus,
        distanceFromOffice: locationResult.distanceFromOffice,
        status: data.workMode === 'wfh' ? 'wfh' : data.workMode === 'field' ? 'field' : 'present',
        workMode: data.workMode,
        notes: data.note,
        reviewDecision: 'flagged',
        verificationMethod: 'admin_override',
        reviewReasons: [
          'Attendance was created through the admin-assisted override flow.',
          `Reason code: ${data.reasonCode}.`,
        ],
      } as never,
    });

    const verification = await prisma.attendanceVerification.create({
      data: {
        attendanceRecordId: record.id,
        userId: employee.id,
        pinVerified: false,
        faceScore: employee.masterPhoto ? 0.7 : 0.4,
        faceDecision: 'flagged',
        livenessScore: 0.45,
        locationStatus: locationResult.locationStatus,
        zoneType: locationResult.zoneType ?? undefined,
        riskScore: Math.max(risk.score, 45),
        riskReasons: [
          ...risk.reasons,
          'Attendance was submitted via admin-assisted override.',
        ],
        aiSummary: buildReviewSummary({
          userName: employee.name,
          score: Math.max(risk.score, 45),
          reasons: [
            ...risk.reasons,
            `Admin override reason: ${data.reasonCode}.`,
          ],
          zoneType: locationResult.zoneType,
          locationStatus: locationResult.locationStatus,
        }),
        reviewStatus: 'pending',
        method: 'admin_override',
      },
    });

    await prisma.reviewQueueItem.create({
      data: {
        attendanceVerificationId: verification.id,
        attendanceRecordId: record.id,
        userId: employee.id,
        riskScore: Math.max(risk.score, 45),
        status: 'pending',
        recommendation: 'Review admin-assisted clock-in for audit completeness.',
        reasons: [
          ...risk.reasons,
          `Admin override by ${req.user!.id}.`,
          `Reason code: ${data.reasonCode}.`,
        ],
      },
    });

    await prisma.adminOverride.create({
      data: {
        attendanceRecordId: record.id,
        employeeId: employee.id,
        adminId: req.user!.id,
        reasonCode: data.reasonCode,
        note: data.note,
      },
    });

    await createAuditLog({
      actorId: req.user!.id,
      action: 'admin.assisted_clock_in',
      entityType: 'attendance',
      entityId: record.id,
      metadata: {
        employeeId: employee.id,
        reasonCode: data.reasonCode,
        note: data.note,
      },
    });

    res.status(201).json({ success: true, data: record, message: 'Admin-assisted clock-in created.' });
  } catch (err) { next(err); }
});

export default router;
