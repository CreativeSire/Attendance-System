import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { verifyToken, requireRole } from '../middleware/auth';
import { createAuditLog } from '../utils/audit';
import { rateLimit } from '../middleware/rateLimit';
import { validateImagePayload } from '../utils/media';

const router = Router();
const authRateLimit = rateLimit({
  windowMs: 60_000,
  max: 30,
  keyPrefix: 'auth',
  keyBuilder: (req) => req.user?.id || (typeof req.body?.refreshToken === 'string' ? req.body.refreshToken.slice(0, 16) : null),
});
const loginRateLimit = rateLimit({
  windowMs: 15 * 60_000,
  max: 12,
  keyPrefix: 'auth-login',
  keyBuilder: (req) => (typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : null),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

const pinSchema = z.object({
  pin: z.string().regex(/^\d{4,6}$/),
});

const faceEnrollmentSchema = z.object({
  images: z.array(z.object({
    kind: z.string().min(1),
    imageRef: z.string().min(1),
    qualityScore: z.number().min(0).max(1).optional(),
  })).min(3).max(5),
  appearanceMetadata: z.record(z.any()).optional(),
});

function generateAccessToken(userId: string, role: string): string {
  return jwt.sign({ id: userId, role }, env.JWT_SECRET, { expiresIn: '15m' });
}

function generateRefreshToken(userId: string): string {
  return jwt.sign({ id: userId, jti: uuidv4() }, env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
}

// POST /api/auth/login
router.post('/login', loginRateLimit, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      await createAuditLog({
        actorName: email,
        action: 'auth.login.failed',
        entityType: 'user',
        metadata: { email, reason: 'user_not_found_or_inactive', ip: req.ip },
      });
      res.status(401).json({ success: false, message: 'Invalid credentials' });
      return;
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      await createAuditLog({
        actorId: user.id,
        actorName: user.email,
        action: 'auth.login.failed',
        entityType: 'user',
        entityId: user.id,
        metadata: { reason: 'password_mismatch', ip: req.ip },
      });
      res.status(401).json({ success: false, message: 'Invalid credentials' });
      return;
    }

    const accessToken = generateAccessToken(user.id, user.role);
    const refreshToken = generateRefreshToken(user.id);
    const deviceFingerprint = typeof req.headers['x-device-fingerprint'] === 'string'
      ? req.headers['x-device-fingerprint']
      : null;

    // Store refresh token in DB
    await prisma.$transaction(async (tx) => {
      await tx.refreshToken.create({
        data: {
          token: refreshToken,
          userId: user.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      if (deviceFingerprint) {
        await tx.deviceProfile.upsert({
          where: {
            userId_fingerprint: {
              userId: user.id,
              fingerprint: deviceFingerprint,
            },
          },
          update: {
            userAgent: req.headers['user-agent'] || null,
            lastSeenAt: new Date(),
          },
          create: {
            userId: user.id,
            fingerprint: deviceFingerprint,
            userAgent: req.headers['user-agent'] || null,
            platform: typeof req.headers['sec-ch-ua-platform'] === 'string' ? req.headers['sec-ch-ua-platform'] : null,
            label: typeof req.headers['x-device-label'] === 'string' ? req.headers['x-device-label'] : null,
            lastSeenAt: new Date(),
          },
        });
      }
    });

    await prisma.refreshToken.deleteMany({
      where: {
        userId: user.id,
        expiresAt: { lt: new Date() },
      },
    });

    await createAuditLog({
      actorId: user.id,
      actorName: user.name,
      action: 'auth.login',
      entityType: 'user',
      entityId: user.id,
      metadata: { role: user.role, email: user.email },
    });

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department,
          employeeId: user.employeeId,
          position: user.position,
          phone: user.phone,
          hasPin: Boolean(user.pinHash),
          hasFaceEnrollment: Boolean(user.masterPhoto),
          masterPhoto: user.masterPhoto,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          appearanceProfile: user.appearanceProfile,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/refresh
router.post('/refresh', authRateLimit, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);

    let decoded: { id: string; jti?: string };
    try {
      decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as { id: string };
    } catch {
      res.status(401).json({ success: false, message: 'Invalid refresh token' });
      return;
    }

    const stored = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      res.status(401).json({ success: false, message: 'Refresh token expired or not found' });
      return;
    }

    if (stored.userId !== decoded.id) {
      res.status(401).json({ success: false, message: 'Token mismatch' });
      return;
    }

    const accessToken = generateAccessToken(stored.user.id, stored.user.role);
    const nextRefreshToken = generateRefreshToken(stored.user.id);

    await prisma.$transaction([
      prisma.refreshToken.delete({ where: { token: refreshToken } }),
      prisma.refreshToken.create({
        data: {
          token: nextRefreshToken,
          userId: stored.user.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      }),
    ]);

    res.json({
      success: true,
      data: { accessToken, refreshToken: nextRefreshToken },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/logout
router.post('/logout', authRateLimit, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const refreshToken = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : null;
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    }

    await createAuditLog({
      actorId: req.user?.id ?? null,
      action: 'auth.logout',
      entityType: 'session',
      metadata: { refreshTokenPresent: Boolean(refreshToken) },
    });

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/me
router.get('/me', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        employeeId: true,
        position: true,
        phone: true,
        masterPhoto: true,
        pinHash: true,
        appearanceProfile: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    res.json({
      success: true,
      data: {
        ...user,
        hasPin: Boolean(user.pinHash),
        hasFaceEnrollment: Boolean(user.masterPhoto),
        pinHash: undefined,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/pin/setup', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pin } = pinSchema.parse(req.body);
    const hashedPin = await bcrypt.hash(pin, 12);

    await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        pinHash: hashedPin,
        pinFailedAttempts: 0,
        pinLockedUntil: null,
      },
    });

    await createAuditLog({
      actorId: req.user!.id,
      action: 'auth.pin.setup',
      entityType: 'user',
      entityId: req.user!.id,
    });

    res.json({ success: true, message: 'PIN saved successfully' });
  } catch (error) {
    next(error);
  }
});

router.post('/pin/reset/:userId', verifyToken, requireRole('admin', 'manager'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pin } = pinSchema.parse(req.body);
    const { userId } = req.params as Record<string, string>;
    const hashedPin = await bcrypt.hash(pin, 12);

    await prisma.user.update({
      where: { id: userId },
      data: {
        pinHash: hashedPin,
        pinFailedAttempts: 0,
        pinLockedUntil: null,
      },
    });

    await createAuditLog({
      actorId: req.user!.id,
      action: 'auth.pin.reset',
      entityType: 'user',
      entityId: userId,
      metadata: { by: req.user!.id },
    });

    res.json({ success: true, message: 'PIN reset successfully' });
  } catch (error) {
    next(error);
  }
});

router.get('/face-enrollment', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const enrollment = await prisma.faceEnrollment.findFirst({
      where: { userId: req.user!.id, isActive: true },
      include: { images: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: enrollment });
  } catch (error) {
    next(error);
  }
});

router.post('/face-enrollment', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = faceEnrollmentSchema.parse(req.body);
    const normalizedImages = data.images.map((image) => ({
      ...image,
      imageRef: validateImagePayload(image.imageRef, `images.${image.kind}`),
    }));
    const activeEnrollment = await prisma.faceEnrollment.findFirst({
      where: { userId: req.user!.id, isActive: true },
      orderBy: { version: 'desc' },
    });

    const nextVersion = (activeEnrollment?.version || 0) + 1;

    const enrollment = await prisma.$transaction(async (tx) => {
      await tx.faceEnrollment.updateMany({
        where: { userId: req.user!.id, isActive: true },
        data: { isActive: false },
      });

      const created = await tx.faceEnrollment.create({
        data: {
          userId: req.user!.id,
          version: nextVersion,
          isActive: true,
          qualityScore: normalizedImages.reduce((sum, item) => sum + (item.qualityScore ?? 0.82), 0) / normalizedImages.length,
          appearanceMetadata: data.appearanceMetadata,
          images: {
            create: normalizedImages.map((image) => ({
              kind: image.kind,
              imageRef: image.imageRef,
              qualityScore: image.qualityScore ?? 0.82,
            })),
          },
        },
        include: { images: true },
      });

      await tx.user.update({
        where: { id: req.user!.id },
        data: {
          masterPhoto: normalizedImages[0]?.imageRef,
          appearanceProfile: data.appearanceMetadata,
        },
      });

      return created;
    });

    await createAuditLog({
      actorId: req.user!.id,
      action: 'auth.face_enrollment.updated',
      entityType: 'face_enrollment',
        entityId: enrollment.id,
      metadata: {
        version: nextVersion,
        imageCount: normalizedImages.length,
      },
    });

    res.json({ success: true, data: enrollment, message: 'Face enrollment saved' });
  } catch (error) {
    next(error);
  }
});

router.patch('/profile', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = z.object({
      name: z.string().min(2).optional(),
      phone: z.string().optional(),
      password: z.string().min(8).optional(),
    }).parse(req.body);

    const updateData: Record<string, unknown> = {};
    if (data.name) updateData.name = data.name;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.password) updateData.password = await bcrypt.hash(data.password, 12);

    const updated = await prisma.user.update({
      where: { id: req.user!.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        employeeId: true,
        position: true,
        phone: true,
        startDate: true,
        basicSalary: true,
        hourlyRate: true,
        masterPhoto: true,
        createdAt: true,
      },
    });

    await createAuditLog({
      actorId: req.user!.id,
      actorName: updated.name,
      action: 'auth.profile.updated',
      entityType: 'user',
      entityId: req.user!.id,
      metadata: { changed: Object.keys(updateData) },
    });

    res.json({ success: true, data: updated, message: 'Profile updated successfully' });
  } catch (error) {
    next(error);
  }
});

router.post('/master-photo', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { photo } = z.object({ photo: z.string().min(1) }).parse(req.body);
    const normalizedPhoto = validateImagePayload(photo, 'photo');

    await prisma.user.update({
      where: { id: req.user!.id },
      data: { masterPhoto: normalizedPhoto },
    });

    await createAuditLog({
      actorId: req.user!.id,
      action: 'auth.master_photo.updated',
      entityType: 'user',
      entityId: req.user!.id,
    });

    res.json({ success: true, data: { url: normalizedPhoto }, message: 'Master photo updated' });
  } catch (error) {
    next(error);
  }
});

export default router;
