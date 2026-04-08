import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { verifyToken } from '../middleware/auth';
import { createAuditLog } from '../utils/audit';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

function generateAccessToken(userId: string, role: string): string {
  return jwt.sign({ id: userId, role }, env.JWT_SECRET, { expiresIn: '15m' });
}

function generateRefreshToken(userId: string): string {
  return jwt.sign({ id: userId, jti: uuidv4() }, env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
}

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
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

    // Store refresh token in DB
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
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
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
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
router.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
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
        startDate: true,
        hourlyRate: true,
        basicSalary: true,
        masterPhoto: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    res.json({ success: true, data: user });
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

    await prisma.user.update({
      where: { id: req.user!.id },
      data: { masterPhoto: photo },
    });

    await createAuditLog({
      actorId: req.user!.id,
      action: 'auth.master_photo.updated',
      entityType: 'user',
      entityId: req.user!.id,
    });

    res.json({ success: true, data: { url: photo }, message: 'Master photo updated' });
  } catch (error) {
    next(error);
  }
});

export default router;
