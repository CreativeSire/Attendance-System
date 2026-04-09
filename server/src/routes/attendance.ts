import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { verifyToken, requireRole } from '../middleware/auth';
import { getIO } from '../socket';
import { createNotification } from '../utils/notifications';
import { createAuditLog } from '../utils/audit';
import { classifyLocationEvidence, getRuntimeConfig, haversineDistanceMeters } from '../utils/settings';
import {
  assessRisk,
  buildLivenessPrompt,
  buildReviewSummary,
  generateLivenessChallenges,
  resolveLocationAndZone,
  upsertDeviceProfile,
} from '../utils/verification';

const router = Router();

router.use(verifyToken);

function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

const verificationStartSchema = z.object({
  pin: z.string().regex(/^\d{4,6}$/),
  workMode: z.enum(['office', 'wfh', 'field', 'client_site']).default('office'),
  lat: z.number().optional(),
  lng: z.number().optional(),
  accuracy: z.number().optional(),
  deviceFingerprint: z.string().optional(),
  deviceLabel: z.string().optional(),
  platform: z.string().optional(),
});

const verificationCompleteSchema = z.object({
  sessionId: z.string(),
  facePhoto: z.string().min(1),
  lateReason: z.string().optional(),
  mood: z.string().optional(),
  livenessResponses: z.array(z.object({
    type: z.enum(['blink_twice', 'turn_left', 'turn_right', 'nod_slowly', 'say_digits']),
    passed: z.boolean(),
    spokenDigits: z.string().optional(),
    confidence: z.number().min(0).max(1).optional(),
  })).min(1),
});

function normalizeAttendanceRecord(record: Record<string, unknown> | null) {
  if (!record) return null;

  const rec = record as Record<string, unknown>;
  return {
    id: rec.id,
    userId: rec.userId,
    user: rec.user,
    date: rec.date,
    clockIn: rec.clockInTime,
    clockOut: rec.clockOutTime,
    status: typeof rec.status === 'string' ? rec.status.toUpperCase() : rec.status,
    entryPoint: rec.entryPoint ? { name: rec.entryPoint } : null,
    lateReason: rec.lateReason,
    faceVerified: Boolean(rec.clockInPhoto),
    qrVerified: rec.clockInMethod === 'qr',
    workHours: rec.totalHours,
    overtimeHours: rec.overtimeHours,
    bddSubmitted: Boolean(rec.bddSubmitted),
    mood: rec.mood,
    createdAt: rec.createdAt,
    updatedAt: rec.updatedAt,
    locationStatus: rec.locationStatus,
    distanceFromOffice: rec.distanceFromOffice,
  };
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

async function validateQRToken(token: string, userId: string): Promise<{ valid: boolean; reason?: string; entryPointId?: string; entryPointName?: string }> {
  const qrToken = await prisma.qRToken.findUnique({ where: { token } });

  if (!qrToken) return { valid: false, reason: 'Token not found' };
  if (qrToken.expiresAt < new Date()) return { valid: false, reason: 'Token expired' };
  if (qrToken.usedAt) return { valid: false, reason: 'Token already used' };

  const entryPoint = await prisma.entryPoint.findUnique({
    where: { id: qrToken.entryPointId },
  });

  if (!entryPoint || !entryPoint.isActive) {
    return { valid: false, reason: 'Entry point inactive' };
  }

  await prisma.qRToken.update({
    where: { id: qrToken.id },
    data: { usedAt: new Date(), usedBy: userId },
  });

  return { valid: true, entryPointId: qrToken.entryPointId, entryPointName: qrToken.entryPointName };
}

async function computeLocationEvidence(input: {
  lat?: number;
  lng?: number;
  accuracy?: number;
}) {
  const { office } = await getRuntimeConfig();
  if (!office || input.lat === undefined || input.lng === undefined) {
    return {
      distanceFromOffice: null,
      locationStatus: 'unavailable',
    };
  }

  const distanceFromOffice = haversineDistanceMeters(
    input.lat,
    input.lng,
    office.latitude,
    office.longitude
  );

  return {
    distanceFromOffice,
    locationStatus: classifyLocationEvidence({
      distanceMeters: distanceFromOffice,
      accuracyMeters: input.accuracy,
      radiusMeters: office.radiusMeters,
    }),
  };
}

// GET /api/attendance/today/:userId
router.get('/today/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params as Record<string, string>;
    if (req.user!.role === 'employee' && req.user!.id !== userId) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const today = getTodayString();
    const record = await prisma.attendanceRecord.findFirst({
      where: { userId, date: today },
      include: { correction: true },
    });

    // Check if BDD submitted today
    const bdd = await prisma.bDDCheckIn.findFirst({ where: { userId, date: today } });

    res.json({
      success: true,
      data: normalizeAttendanceRecord(record ? { ...record, bddSubmitted: !!bdd } : null),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/verification/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = verificationStartSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        faceEnrollments: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { images: true },
        },
        adminOverridesReceived: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    if (!user.pinHash) {
      res.status(400).json({ success: false, message: 'Employee PIN has not been set up yet.' });
      return;
    }

    if (user.pinLockedUntil && user.pinLockedUntil > new Date()) {
      res.status(423).json({ success: false, message: 'PIN is temporarily locked. Contact admin if this continues.' });
      return;
    }

    const pinVerified = await bcrypt.compare(data.pin, user.pinHash);
    if (!pinVerified) {
      const failedAttempts = user.pinFailedAttempts + 1;
      const pinLockedUntil = failedAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          pinFailedAttempts: failedAttempts,
          pinLockedUntil,
        },
      });

      await createAuditLog({
        actorId: user.id,
        actorName: user.email,
        action: 'attendance.pin.failed',
        entityType: 'user',
        entityId: user.id,
        metadata: { failedAttempts },
      });

      res.status(401).json({ success: false, message: failedAttempts >= 5 ? 'PIN locked after repeated failed attempts.' : 'Invalid employee PIN.' });
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        pinFailedAttempts: 0,
        pinLockedUntil: null,
      },
    });

    const device = await upsertDeviceProfile({
      userId: user.id,
      fingerprint: data.deviceFingerprint ?? null,
      label: data.deviceLabel ?? null,
      userAgent: req.headers['user-agent'] || null,
      platform: data.platform ?? null,
    });

    const locationResult = await resolveLocationAndZone({
      lat: data.lat,
      lng: data.lng,
      accuracy: data.accuracy,
    });

    const baselineRisk = assessRisk({
      pinVerified: true,
      hasEnrollment: user.faceEnrollments.length > 0,
      faceScore: user.faceEnrollments[0]?.qualityScore ?? 0.4,
      livenessScore: 1,
      locationStatus: locationResult.locationStatus,
      zoneType: locationResult.zoneType,
      knownDevice: device.known,
      lateMinutes: 0,
      previousOverrides: user.adminOverridesReceived.length,
    });

    const challengeTypes = generateLivenessChallenges(baselineRisk.score);
    const prompts = challengeTypes.map((type) => ({
      type,
      prompt: buildLivenessPrompt(type),
    }));

    const session = await prisma.verificationSession.create({
      data: {
        userId: user.id,
        workMode: data.workMode,
        pinVerified: true,
        deviceFingerprint: data.deviceFingerprint,
        deviceLabel: data.deviceLabel,
        locationLat: data.lat,
        locationLng: data.lng,
        locationAccuracy: data.accuracy,
        locationStatus: locationResult.locationStatus,
        distanceFromOffice: locationResult.distanceFromOffice,
        officeZoneId: locationResult.zone?.id,
        challengeTypes,
        riskScore: baselineRisk.score,
        riskReasons: baselineRisk.reasons,
        expiresAt: new Date(Date.now() + 90 * 1000),
      },
    });

    await createAuditLog({
      actorId: user.id,
      actorName: user.email,
      action: 'attendance.verification.started',
      entityType: 'verification_session',
      entityId: session.id,
      metadata: {
        workMode: data.workMode,
        locationStatus: locationResult.locationStatus,
        zoneType: locationResult.zoneType,
        riskScore: baselineRisk.score,
        challengeTypes,
      },
    });

    res.json({
      success: true,
      data: {
        sessionId: session.id,
        expiresAt: session.expiresAt,
        prompts,
        location: {
          status: locationResult.locationStatus,
          distanceFromOffice: locationResult.distanceFromOffice,
          zoneType: locationResult.zoneType,
          zoneName: locationResult.zone?.name ?? null,
        },
        risk: {
          score: baselineRisk.score,
          reasons: baselineRisk.reasons,
        },
        enrollmentReady: user.faceEnrollments.length > 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/verification/complete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = verificationCompleteSchema.parse(req.body);
    const today = getTodayString();

    const existing = await prisma.attendanceRecord.findFirst({
      where: { userId: req.user!.id, date: today },
    });

    if (existing) {
      res.status(400).json({ success: false, message: 'Attendance already exists for today.' });
      return;
    }

    const session = await prisma.verificationSession.findUnique({
      where: { id: data.sessionId },
      include: {
        user: {
          include: {
            faceEnrollments: {
              where: { isActive: true },
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: { images: true },
            },
            adminOverridesReceived: {
              take: 10,
            },
          },
        },
        officeZone: true,
      },
    });

    if (!session || session.userId !== req.user!.id) {
      res.status(404).json({ success: false, message: 'Verification session not found.' });
      return;
    }

    if (session.expiresAt < new Date()) {
      res.status(400).json({ success: false, message: 'Verification session expired. Please start again.' });
      return;
    }

    const activeEnrollment = session.user.faceEnrollments[0] ?? null;
    const averageLiveness = data.livenessResponses.reduce((sum, item) => sum + (item.confidence ?? (item.passed ? 0.85 : 0.2)), 0) / data.livenessResponses.length;
    const faceScore = activeEnrollment ? Math.max(0.72, Math.min(0.96, activeEnrollment.qualityScore || 0.84)) : 0.45;

    const now = new Date();
    const { appConfig } = await getRuntimeConfig();
    const [startHour, startMinute] = appConfig.workStartTime.split(':').map((value: string) => parseInt(value, 10));
    const startOfWork = new Date(now);
    startOfWork.setHours(startHour, startMinute, 0, 0);
    const lateThreshold = new Date(startOfWork);
    lateThreshold.setMinutes(lateThreshold.getMinutes() + appConfig.gracePeriodMinutes);
    const isLate = now > lateThreshold;
    const lateMinutes = isLate ? Math.floor((now.getTime() - startOfWork.getTime()) / 60000) : 0;

    const risk = assessRisk({
      pinVerified: session.pinVerified,
      hasEnrollment: Boolean(activeEnrollment),
      faceScore,
      livenessScore: averageLiveness,
      locationStatus: session.locationStatus || 'unavailable',
      zoneType: session.officeZone?.type ?? null,
      knownDevice: Boolean(session.deviceFingerprint),
      lateMinutes,
      previousOverrides: session.user.adminOverridesReceived.length,
    });

    const record = await prisma.attendanceRecord.create({
      data: {
        userId: req.user!.id,
        date: today,
        clockInTime: now,
        clockInPhoto: data.facePhoto,
        clockInMethod: 'pin_face_location',
        clockInLat: session.locationLat,
        clockInLng: session.locationLng,
        clockInAccuracy: session.locationAccuracy,
        locationStatus: session.locationStatus,
        distanceFromOffice: session.distanceFromOffice,
        status: session.workMode === 'wfh'
          ? 'wfh'
          : session.workMode === 'field'
            ? 'field'
            : isLate
              ? 'late'
              : 'present',
        workMode: session.workMode,
        isLate,
        lateMinutes,
        lateReason: data.lateReason,
        mood: data.mood,
        reviewDecision: risk.decision,
        verificationMethod: 'pin_face_location',
        reviewReasons: risk.reasons,
      } as never,
    });

    const verification = await prisma.attendanceVerification.create({
      data: {
        attendanceRecordId: record.id,
        userId: req.user!.id,
        verificationSessionId: session.id,
        pinVerified: session.pinVerified,
        faceScore,
        faceDecision: activeEnrollment ? (faceScore < 0.72 ? 'flagged' : 'approved') : 'blocked',
        livenessScore: averageLiveness,
        locationStatus: session.locationStatus,
        zoneType: session.officeZone?.type,
        riskScore: risk.score,
        riskReasons: risk.reasons,
        aiSummary: buildReviewSummary({
          userName: session.user.name,
          score: risk.score,
          reasons: risk.reasons,
          zoneType: session.officeZone?.type,
          locationStatus: session.locationStatus || 'unavailable',
        }),
        reviewStatus: risk.recommendReview ? 'pending' : 'approved',
        method: 'pin_face_location',
      },
    });

    await prisma.livenessAttempt.create({
      data: {
        userId: req.user!.id,
        verificationSessionId: session.id,
        attendanceVerificationId: verification.id,
        challengeTypes: data.livenessResponses.map((item) => item.type),
        spokenDigits: data.livenessResponses.find((item) => item.spokenDigits)?.spokenDigits,
        resultScore: averageLiveness,
        passed: averageLiveness >= 0.75,
        metadata: data.livenessResponses,
      },
    });

    if (risk.recommendReview) {
      await prisma.reviewQueueItem.create({
        data: {
          attendanceVerificationId: verification.id,
          attendanceRecordId: record.id,
          userId: req.user!.id,
          riskScore: risk.score,
          status: 'pending',
          recommendation: risk.decision === 'blocked' ? 'Manager review required before approval.' : 'Manager review recommended.',
          reasons: risk.reasons,
        },
      });
    }

    await prisma.verificationSession.update({
      where: { id: session.id },
      data: {
        completedAt: new Date(),
        riskScore: risk.score,
        riskReasons: risk.reasons,
      },
    });

    await createAuditLog({
      actorId: req.user!.id,
      actorName: session.user.name,
      action: 'attendance.verification.completed',
      entityType: 'attendance',
      entityId: record.id,
      metadata: {
        riskScore: risk.score,
        riskDecision: risk.decision,
        reasons: risk.reasons,
        livenessScore: averageLiveness,
        faceScore,
        zoneType: session.officeZone?.type,
      },
    });

    res.json({
      success: true,
      data: {
        ...normalizeAttendanceRecord({ ...record, bddSubmitted: false }),
        verification: {
          id: verification.id,
          riskScore: risk.score,
          decision: risk.decision,
          reasons: risk.reasons,
          reviewStatus: risk.recommendReview ? 'pending' : 'approved',
        },
      },
      message: risk.decision === 'blocked'
        ? 'Clock-in submitted but flagged for review.'
        : isLate
          ? `Clocked in (${lateMinutes} minutes late)`
          : 'Clocked in successfully',
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/attendance/clock-in
router.post('/clock-in', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      qrToken: z.string(),
      userId: z.string().optional(),
      photo: z.string().optional(),
      facePhoto: z.string().optional(),
      mood: z.string().optional(),
      workMode: z.enum(['office', 'wfh', 'field', 'client_site']).default('office'),
      lat: z.number().optional(),
      lng: z.number().optional(),
      accuracy: z.number().optional(),
      lateReason: z.string().optional(),
    });
    const data = schema.parse(req.body);
    const userId = data.userId || req.user!.id;

    if (req.user!.role === 'employee' && req.user!.id !== userId) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const today = getTodayString();

    // Check no existing clock-in today
    const existing = await prisma.attendanceRecord.findFirst({
      where: { userId, date: today },
    });
    if (existing) {
      res.status(400).json({ success: false, message: 'Already clocked in today' });
      return;
    }

    // Validate QR token
    const qrResult = await validateQRToken(data.qrToken, userId);
    if (!qrResult.valid) {
      res.status(400).json({ success: false, message: `Invalid QR: ${qrResult.reason}` });
      return;
    }

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { name: true },
    });

    const now = new Date();
    const { appConfig } = await getRuntimeConfig();
    if (appConfig.requireFaceCapture && !(data.facePhoto || data.photo)) {
      res.status(400).json({ success: false, message: 'Face verification is required' });
      return;
    }

    if (appConfig.requireLocation && data.workMode === 'office' && (data.lat === undefined || data.lng === undefined)) {
      res.status(400).json({ success: false, message: 'Location access is required for office clock-in' });
      return;
    }

    const [startHour, startMinute] = appConfig.workStartTime.split(':').map((value: string) => parseInt(value, 10));
    const startOfWork = new Date(now);
    startOfWork.setHours(startHour, startMinute, 0, 0);
    const lateThreshold = new Date(startOfWork);
    lateThreshold.setMinutes(lateThreshold.getMinutes() + appConfig.gracePeriodMinutes);

    const isLate = now > lateThreshold;
    const lateMinutes = isLate ? Math.floor((now.getTime() - startOfWork.getTime()) / 60000) : 0;

    const workModeStatus = data.workMode === 'wfh' ? 'wfh' : data.workMode === 'field' ? 'field' : isLate ? 'late' : 'present';
    const locationEvidence = await computeLocationEvidence({
      lat: data.lat,
      lng: data.lng,
      accuracy: data.accuracy,
    });

    const record = await prisma.attendanceRecord.create({
      data: {
        userId,
        date: today,
        clockInTime: now,
        clockInPhoto: data.facePhoto || data.photo,
        clockInMethod: 'qr',
        clockInLat: data.lat,
        clockInLng: data.lng,
        clockInAccuracy: data.accuracy,
        locationStatus: locationEvidence.locationStatus,
        distanceFromOffice: locationEvidence.distanceFromOffice,
        status: workModeStatus as 'present' | 'late' | 'absent' | 'wfh' | 'field',
        workMode: data.workMode,
        isLate,
        lateMinutes,
        lateReason: data.lateReason,
        mood: data.mood,
        entryPoint: qrResult.entryPointName,
      } as any,
    });

    await createAuditLog({
      actorId: userId,
      actorName: user.name,
      action: 'attendance.clock_in',
      entityType: 'attendance',
      entityId: record.id,
      metadata: {
        workMode: data.workMode,
        isLate,
        lateMinutes,
        locationStatus: locationEvidence.locationStatus,
        distanceFromOffice: locationEvidence.distanceFromOffice,
        entryPoint: qrResult.entryPointName,
      },
    });

    // Emit socket event
    try {
      const io = getIO();
      io.to('role:admin').to('role:manager').emit('attendance:clockin', {
        userId,
        userName: user.name,
        clockInTime: now,
        entryPoint: qrResult.entryPointName,
        isLate,
        lateMinutes,
        workMode: data.workMode,
      });
    } catch {
      // Socket not ready
    }

    // Notify if late
    if (isLate) {
      await createNotification(
        userId,
        'Late Clock-in',
        `You clocked in ${lateMinutes} minutes late today.`,
        'warning'
      );
    }

    res.json({
      success: true,
      data: normalizeAttendanceRecord({ ...record, bddSubmitted: false }),
      message: isLate ? `Clocked in (${lateMinutes} minutes late)` : 'Clocked in successfully',
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/attendance/clock-out
router.post('/clock-out', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      userId: z.string().optional(),
      photo: z.string().optional(),
      facePhoto: z.string().optional(),
      lat: z.number().optional(),
      lng: z.number().optional(),
      accuracy: z.number().optional(),
    });
    const data = schema.parse(req.body);
    const userId = data.userId || req.user!.id;

    if (req.user!.role === 'employee' && req.user!.id !== userId) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const today = getTodayString();

    const existingRecord = await prisma.attendanceRecord.findFirst({
      where: { userId, date: today },
    });

    if (!existingRecord) {
      res.status(400).json({ success: false, message: 'No clock-in record found for today' });
      return;
    }

    if (existingRecord.clockOutTime) {
      res.status(400).json({ success: false, message: 'Already clocked out today' });
      return;
    }

    const now = new Date();
    const clockIn = existingRecord.clockInTime!;
    const totalHours = (now.getTime() - clockIn.getTime()) / 3600000;
    const overtimeHours = Math.max(0, totalHours - 8);

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { name: true },
    });

    const locationEvidence = await computeLocationEvidence({
      lat: data.lat,
      lng: data.lng,
      accuracy: data.accuracy,
    });

    const previousRecord = existingRecord as typeof existingRecord & {
      locationStatus?: string | null;
      distanceFromOffice?: number | null;
    };

    const record = await prisma.attendanceRecord.update({
      where: { id: existingRecord.id },
      data: {
        clockOutTime: now,
        clockOutPhoto: data.facePhoto || data.photo,
        clockOutMethod: 'manual',
        clockOutLat: data.lat,
        clockOutLng: data.lng,
        clockOutAccuracy: data.accuracy,
        totalHours,
        overtimeHours,
        locationStatus: locationEvidence.locationStatus || previousRecord.locationStatus,
        distanceFromOffice: locationEvidence.distanceFromOffice ?? previousRecord.distanceFromOffice,
      } as any,
    }) as typeof existingRecord & { locationStatus?: string | null; distanceFromOffice?: number | null };

    await createAuditLog({
      actorId: userId,
      actorName: user.name,
      action: 'attendance.clock_out',
      entityType: 'attendance',
      entityId: record.id,
      metadata: { totalHours, overtimeHours },
    });

    // Emit socket event
    try {
      const io = getIO();
      io.to('role:admin').to('role:manager').emit('attendance:clockout', {
        userId,
        userName: user.name,
        clockOutTime: now,
        totalHours,
        overtimeHours,
      });
    } catch {
      // Socket not ready
    }

    res.json({
      success: true,
      data: normalizeAttendanceRecord({ ...record, bddSubmitted: false }),
      message: 'Clocked out successfully',
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/attendance/user/:userId
router.get('/user/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params as Record<string, string>;
    const { month, year } = req.query as Record<string, string>;

    if (req.user!.role === 'employee' && req.user!.id !== userId) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const whereClause: Record<string, unknown> = { userId };
    if (month && year) {
      const monthStr = String(month).padStart(2, '0');
      whereClause.date = { startsWith: `${year}-${monthStr}` };
    }

    const records = await prisma.attendanceRecord.findMany({
      where: whereClause,
      include: { correction: true },
      orderBy: { date: 'desc' },
    });

    // For each record, check if BDD was submitted on that day
    const recordsWithBDD = await Promise.all(
      records.map(async (r) => {
        const bdd = await prisma.bDDCheckIn.findFirst({
          where: { userId, date: r.date },
          select: { id: true, submittedAt: true },
        });
        return { ...r, bddSubmitted: !!bdd, bddSubmittedAt: bdd?.submittedAt || null };
      })
    );

    res.json({ success: true, data: recordsWithBDD.map((record) => normalizeAttendanceRecord(record)) });
  } catch (error) {
    next(error);
  }
});

// GET /api/attendance/all
router.get('/all', requireRole('admin', 'manager'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date, department, status } = req.query as Record<string, string>;

    const records = await prisma.attendanceRecord.findMany({
      where: {
        ...(date ? { date: String(date) } : {}),
        ...(status ? { status: String(status) as 'present' | 'late' | 'absent' | 'wfh' | 'field' } : {}),
        user: {
          isActive: true,
          ...(department ? { department: String(department) } : {}),
        },
      },
      include: {
        user: {
          select: { id: true, name: true, department: true, employeeId: true, position: true },
        },
        correction: true,
      },
      orderBy: [{ date: 'desc' }, { clockInTime: 'asc' }],
    });

    res.json({ success: true, data: records.map((record) => normalizeAttendanceRecord(record)) });
  } catch (error) {
    next(error);
  }
});

// GET /api/attendance/live
router.get('/live', requireRole('admin', 'manager'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const today = getTodayString();

    const allEmployees = await prisma.user.findMany({
      where: { isActive: true, role: { not: 'admin' } },
      select: { id: true, name: true, department: true, position: true, masterPhoto: true, employeeId: true },
    });

    const todayRecords = await prisma.attendanceRecord.findMany({
      where: { date: today },
    });

    const approvedLeaves = await prisma.leaveRequest.findMany({
      where: {
        status: 'approved',
        startDate: { lte: today },
        endDate: { gte: today },
      },
    });

    const liveFeed = allEmployees.map((emp) => {
      const record = todayRecords.find((r) => r.userId === emp.id);
      const onLeave = approvedLeaves.find((l) => l.userId === emp.id);

      let statusLabel = 'not_in';
      if (onLeave) statusLabel = 'on_leave';
      else if (record?.clockOutTime) statusLabel = 'clocked_out';
      else if (record?.clockInTime) statusLabel = record.isLate ? 'late' : 'in';
      else statusLabel = 'absent';

      return {
        ...emp,
        status: statusLabel,
        clockInTime: record?.clockInTime || null,
        clockOutTime: record?.clockOutTime || null,
        isLate: record?.isLate || false,
        lateMinutes: record?.lateMinutes || 0,
        workMode: record?.workMode || null,
        mood: record?.mood || null,
        entryPoint: record?.entryPoint || null,
        totalHours: record?.totalHours || null,
        onLeave: !!onLeave,
      };
    });

    const summary = {
      total: allEmployees.length,
      clockedIn: liveFeed.filter((e) => e.status === 'in' || e.status === 'late').length,
      late: liveFeed.filter((e) => e.status === 'late').length,
      clockedOut: liveFeed.filter((e) => e.status === 'clocked_out').length,
      onLeave: liveFeed.filter((e) => e.status === 'on_leave').length,
      absent: liveFeed.filter((e) => e.status === 'absent').length,
    };

    res.json({ success: true, data: { employees: liveFeed, summary } });
  } catch (error) {
    next(error);
  }
});

// POST /api/attendance/:id/correct
router.post('/:id/correct', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as Record<string, string>;
    const schema = z.object({
      reason: z.string().min(1),
      newClockIn: z.string().optional(),
      newClockOut: z.string().optional(),
    });
    const data = schema.parse(req.body);

    const record = await prisma.attendanceRecord.findUnique({ where: { id } });
    if (!record) {
      res.status(404).json({ success: false, message: 'Record not found' });
      return;
    }

    if (req.user!.role === 'employee' && req.user!.id !== record.userId) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const correction = await prisma.correctionRequest.create({
      data: {
        recordId: id,
        requestedBy: req.user!.id,
        reason: data.reason,
        newClockIn: data.newClockIn,
        newClockOut: data.newClockOut,
      },
    });

    await createAuditLog({
      actorId: req.user!.id,
      action: 'attendance.correction.requested',
      entityType: 'attendance',
      entityId: id,
      metadata: {
        correctionId: correction.id,
        reason: data.reason,
        newClockIn: data.newClockIn,
        newClockOut: data.newClockOut,
      },
    });

    res.status(201).json({
      success: true,
      data: correction,
      message: 'Correction request submitted',
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/attendance/corrections/:id
router.patch('/corrections/:id', requireRole('admin', 'manager'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as Record<string, string>;
    const schema = z.object({
      status: z.enum(['approved', 'rejected']),
      reviewNote: z.string().optional(),
    });
    const data = schema.parse(req.body);

    const correction = await prisma.correctionRequest.update({
      where: { id },
      data: {
        status: data.status,
        reviewedBy: req.user!.id,
        reviewNote: data.reviewNote,
      },
      include: { record: true },
    });

    // If approved, update the attendance record
    if (data.status === 'approved') {
      const updateData: Record<string, unknown> = {};
      if (correction.newClockIn) updateData.clockInTime = new Date(correction.newClockIn);
      if (correction.newClockOut) {
        updateData.clockOutTime = new Date(correction.newClockOut);
        if (correction.newClockIn) {
          const inTime = new Date(correction.newClockIn);
          const outTime = new Date(correction.newClockOut);
          const totalHours = (outTime.getTime() - inTime.getTime()) / 3600000;
          updateData.totalHours = totalHours;
          updateData.overtimeHours = Math.max(0, totalHours - 8);
        }
      }
      if (Object.keys(updateData).length > 0) {
        await prisma.attendanceRecord.update({
          where: { id: correction.recordId },
          data: updateData,
        });
      }
    }

    await createAuditLog({
      actorId: req.user!.id,
      action: `attendance.correction.${data.status}`,
      entityType: 'attendance',
      entityId: correction.recordId,
      metadata: {
        correctionId: correction.id,
        reviewNote: data.reviewNote,
      },
    });

    // Notify the requester
    await createNotification(
      correction.requestedBy,
      `Correction Request ${data.status === 'approved' ? 'Approved' : 'Rejected'}`,
      `Your attendance correction request has been ${data.status}.${data.reviewNote ? ` Note: ${data.reviewNote}` : ''}`,
      data.status === 'approved' ? 'success' : 'error'
    );

    res.json({ success: true, data: correction, message: `Correction ${data.status}` });
  } catch (error) {
    next(error);
  }
});

// GET /api/attendance/corrections
router.get('/corrections', requireRole('admin', 'manager'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.query as Record<string, string>;

    const corrections = await prisma.correctionRequest.findMany({
      where: {
        ...(status ? { status: String(status) as 'pending' | 'approved' | 'rejected' } : { status: 'pending' }),
      },
      include: {
        record: {
          include: {
            user: {
              select: { id: true, name: true, department: true, employeeId: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: corrections });
  } catch (error) {
    next(error);
  }
});

export { validateQRToken, getWeekNumber };

router.get('/today-status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const today = getTodayString();
    const record = await prisma.attendanceRecord.findFirst({
      where: { userId: req.user!.id, date: today },
      orderBy: { createdAt: 'desc' },
    });
    const bdd = await prisma.bDDCheckIn.findFirst({
      where: { userId: req.user!.id, date: today },
      select: { id: true },
    });

    res.json({ success: true, data: normalizeAttendanceRecord(record ? { ...record, bddSubmitted: !!bdd } : null) });
  } catch (error) {
    next(error);
  }
});

router.get('/my', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { month, year } = req.query as Record<string, string>;
    const whereClause: Record<string, unknown> = { userId: req.user!.id };
    if (month && year) {
      whereClause.date = { startsWith: `${year}-${String(month).padStart(2, '0')}` };
    }

    const records = await prisma.attendanceRecord.findMany({
      where: whereClause,
      orderBy: { date: 'desc' },
    });

    const data = await Promise.all(records.map(async (record) => {
      const bdd = await prisma.bDDCheckIn.findFirst({
        where: { userId: req.user!.id, date: record.date },
        select: { id: true },
      });
      return normalizeAttendanceRecord({ ...record, bddSubmitted: !!bdd });
    }));

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get('/team', requireRole('admin', 'manager'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { month, year, date, department } = req.query as Record<string, string>;
    const records = await prisma.attendanceRecord.findMany({
      where: {
        ...(date ? { date } : {}),
        ...(month && year ? { date: { startsWith: `${year}-${String(month).padStart(2, '0')}` } } : {}),
        ...(department ? { user: { department } } : {}),
      },
      include: {
        user: {
          select: { id: true, name: true, department: true, employeeId: true, position: true },
        },
      },
      orderBy: [{ date: 'desc' }, { clockInTime: 'desc' }],
    });

    res.json({ success: true, data: records.map((record) => normalizeAttendanceRecord(record)) });
  } catch (error) {
    next(error);
  }
});

router.get('/my-stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { month, year } = req.query as Record<string, string>;
    const now = new Date();
    const yearValue = parseInt(year || String(now.getFullYear()), 10);
    const monthValue = parseInt(month || String(now.getMonth() + 1), 10);
    const prefix = `${yearValue}-${String(monthValue).padStart(2, '0')}`;
    const records = await prisma.attendanceRecord.findMany({
      where: { userId: req.user!.id, date: { startsWith: prefix } },
    });

    const presentDays = records.filter((record) => record.status !== 'absent').length;
    const lateDays = records.filter((record) => record.isLate).length;
    const absentDays = records.filter((record) => record.status === 'absent').length;
    const totalWorkHours = records.reduce((sum, record) => sum + (record.totalHours || 0), 0);
    const overtimeHours = records.reduce((sum, record) => sum + (record.overtimeHours || 0), 0);
    const attendanceRate = records.length > 0 ? (presentDays / records.length) * 100 : 0;

    res.json({
      success: true,
      data: {
        presentDays,
        lateDays,
        absentDays,
        totalWorkHours,
        overtimeHours,
        attendanceRate,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/live-feed', requireRole('admin', 'manager'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const today = getTodayString();
    const records = await prisma.attendanceRecord.findMany({
      where: { date: today },
      include: {
        user: {
          select: { id: true, name: true, department: true, employeeId: true, position: true },
        },
      },
      orderBy: { clockInTime: 'desc' },
    });

    res.json({ success: true, data: records.map((record) => normalizeAttendanceRecord(record)) });
  } catch (error) {
    next(error);
  }
});

router.post('/correction', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = z.object({
      attendanceId: z.string(),
      reason: z.string().min(1),
      requestedClockIn: z.string().optional(),
      requestedClockOut: z.string().optional(),
    }).parse(req.body);

    const record = await prisma.attendanceRecord.findUnique({ where: { id: data.attendanceId } });
    if (!record) {
      res.status(404).json({ success: false, message: 'Record not found' });
      return;
    }

    if (req.user!.role === 'employee' && req.user!.id !== record.userId) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const correction = await prisma.correctionRequest.create({
      data: {
        recordId: data.attendanceId,
        requestedBy: req.user!.id,
        reason: data.reason,
        newClockIn: data.requestedClockIn,
        newClockOut: data.requestedClockOut,
      },
    });

    res.status(201).json({ success: true, data: correction, message: 'Correction request submitted' });
  } catch (error) {
    next(error);
  }
});

router.patch('/corrections/:id/approve', requireRole('admin', 'manager'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    req.body.status = 'approved';
    req.body.reviewNote = req.body.note;
    next();
  } catch (error) {
    next(error);
  }
}, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as Record<string, string>;
    const correction = await prisma.correctionRequest.update({
      where: { id },
      data: { status: 'approved', reviewedBy: req.user!.id },
    });
    res.json({ success: true, data: correction });
  } catch (error) {
    next(error);
  }
});

router.patch('/corrections/:id/reject', requireRole('admin', 'manager'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as Record<string, string>;
    const { reason } = z.object({ reason: z.string().optional() }).parse(req.body);
    const correction = await prisma.correctionRequest.update({
      where: { id },
      data: { status: 'rejected', reviewedBy: req.user!.id, reviewNote: reason },
    });
    res.json({ success: true, data: correction });
  } catch (error) {
    next(error);
  }
});

export default router;
