import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../config/prisma';
import { verifyToken, requireRole } from '../middleware/auth';
import { getIO } from '../socket';

const router = Router();

async function generateQRForEntryPoint(entryPointId: string, entryPointName: string) {
  const appConfig = await prisma.appConfig.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default' },
  });
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + appConfig.qrExpirySeconds * 1000);

  const qrToken = await prisma.qRToken.create({
    data: {
      token,
      entryPointId,
      entryPointName,
      expiresAt,
    },
  });

  const qrDataUrl = await QRCode.toDataURL(token, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 300,
  });

  return { ...qrToken, qrDataUrl };
}

// POST /api/qr/generate
router.post('/generate', verifyToken, requireRole('admin', 'manager'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      entryPointId: z.string(),
      entryPointName: z.string(),
    });
    const { entryPointId, entryPointName } = schema.parse(req.body);

    const result = await generateQRForEntryPoint(entryPointId, entryPointName);

    res.json({
      success: true,
      data: {
        token: result.token,
        qrDataUrl: result.qrDataUrl,
        expiresAt: result.expiresAt,
        entryPointId: result.entryPointId,
        entryPointName: result.entryPointName,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/qr/active
router.get('/active', verifyToken, requireRole('admin', 'manager'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const activeTokens = await prisma.qRToken.findMany({
      where: {
        expiresAt: { gt: now },
        usedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    const results = await Promise.all(
      activeTokens.map(async (t) => {
        const qrDataUrl = await QRCode.toDataURL(t.token, {
          errorCorrectionLevel: 'H',
          margin: 2,
          width: 300,
        });
        return {
          entryPointId: t.entryPointId,
          entryPointName: t.entryPointName,
          token: t.token,
          expiresAt: t.expiresAt,
          qrDataUrl,
        };
      })
    );

    res.json({ success: true, data: results });
  } catch (error) {
    next(error);
  }
});

// GET /api/qr/entry/:entryPointId
router.get('/entry/:entryPointId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entryPointId } = req.params as Record<string, string>;
    const now = new Date();

    // Find active token for this entry point
    let activeToken = await prisma.qRToken.findFirst({
      where: {
        entryPointId,
        expiresAt: { gt: now },
        usedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    let entryPointName = activeToken?.entryPointName;

    // If no active token, get entry point name and generate new one
    if (!activeToken) {
      const entryPoint = await prisma.entryPoint.findUnique({
        where: { id: entryPointId },
      });

      if (!entryPoint) {
        res.status(404).json({ success: false, message: 'Entry point not found' });
        return;
      }

      entryPointName = entryPoint.name;
      activeToken = await generateQRForEntryPoint(entryPointId, entryPoint.name);
    }

    const qrDataUrl = await QRCode.toDataURL(activeToken.token, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 300,
    });

    res.json({
      success: true,
      data: {
        entryPointId,
        entryPointName,
        token: activeToken.token,
        expiresAt: activeToken.expiresAt,
        qrDataUrl,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/qr/validate
router.post('/validate', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      token: z.string(),
      userId: z.string().optional(),
    });
    const { token } = schema.parse(req.body);

    const qrToken = await prisma.qRToken.findUnique({
      where: { token },
    });

    if (!qrToken) {
      res.json({ success: true, data: { valid: false, reason: 'Token not found' } });
      return;
    }

    if (qrToken.expiresAt < new Date()) {
      res.json({ success: true, data: { valid: false, reason: 'Token expired' } });
      return;
    }

    if (qrToken.usedAt) {
      res.json({ success: true, data: { valid: false, reason: 'Token already used' } });
      return;
    }

    const entryPoint = await prisma.entryPoint.findUnique({
      where: { id: qrToken.entryPointId },
    });

    res.json({
      success: true,
      data: {
        valid: true,
        entryPointId: qrToken.entryPointId,
        entryPointName: qrToken.entryPointName,
        entryPoint: entryPoint
          ? {
              id: entryPoint.id,
              name: entryPoint.name,
              location: entryPoint.location,
              active: entryPoint.isActive,
            }
          : null,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/qr/entry-points
router.get('/entry-points', verifyToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entryPoints = await prisma.entryPoint.findMany({
      where: req.user?.role === 'admin' ? {} : { isActive: true },
      orderBy: { name: 'asc' },
    });
    res.json({
      success: true,
      data: entryPoints.map((entryPoint) => ({
        id: entryPoint.id,
        name: entryPoint.name,
        location: entryPoint.location,
        active: entryPoint.isActive,
        createdAt: entryPoint.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/qr/entry-points
router.post('/entry-points', verifyToken, requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      name: z.string().min(1),
      location: z.string().min(1),
      active: z.boolean().optional(),
    });
    const data = schema.parse(req.body);

    const entryPoint = await prisma.entryPoint.create({
      data: {
        name: data.name,
        location: data.location,
        isActive: data.active ?? true,
      },
    });
    res.status(201).json({
      success: true,
      data: {
        id: entryPoint.id,
        name: entryPoint.name,
        location: entryPoint.location,
        active: entryPoint.isActive,
      },
      message: 'Entry point created',
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/entry-points/:id', verifyToken, requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as Record<string, string>;
    const data = z.object({
      name: z.string().min(1).optional(),
      location: z.string().min(1).optional(),
      active: z.boolean().optional(),
    }).parse(req.body);

    const updated = await prisma.entryPoint.update({
      where: { id },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.location ? { location: data.location } : {}),
        ...(typeof data.active === 'boolean' ? { isActive: data.active } : {}),
      },
    });

    res.json({
      success: true,
      data: {
        id: updated.id,
        name: updated.name,
        location: updated.location,
        active: updated.isActive,
      },
      message: 'Entry point updated',
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/entry-points/:id', verifyToken, requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as Record<string, string>;
    await prisma.entryPoint.delete({ where: { id } });
    res.json({ success: true, message: 'Entry point deleted' });
  } catch (error) {
    next(error);
  }
});

// Background job: refresh QR tokens every 30 seconds
export function startQRRefreshJob(): void {
  setInterval(async () => {
    try {
      const now = new Date();
      const entryPoints = await prisma.entryPoint.findMany({ where: { isActive: true } });

      for (const ep of entryPoints) {
        // Check if there's an active token for this entry point
        const activeToken = await prisma.qRToken.findFirst({
          where: {
            entryPointId: ep.id,
            expiresAt: { gt: now },
            usedAt: null,
          },
        });

        if (!activeToken) {
          // Generate new token
          const newToken = await generateQRForEntryPoint(ep.id, ep.name);

          // Emit to entry point subscribers
          try {
            const io = getIO();
            io.to(`entryPoint:${ep.id}`).emit('qr:refresh', {
              entryPointId: ep.id,
              entryPointName: ep.name,
              token: newToken.token,
              expiresAt: newToken.expiresAt,
              qrDataUrl: newToken.qrDataUrl,
            });
          } catch {
            // Socket not initialized yet — skip emit
          }
        }
      }
    } catch (error) {
      console.error('[QR Refresh Job] Error:', error);
    }
  }, 30 * 1000);
}

export default router;
