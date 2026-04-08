import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { verifyToken, requireRole } from '../middleware/auth';
import { getIO } from '../socket';

const router = Router();
router.use(verifyToken);

const broadcastSchema = z.object({
  title: z.string().min(1),
  message: z.string().min(1),
  department: z.string().optional(),
  targetDepartment: z.string().optional(),
  expiresAt: z.string().optional(),
});

// GET /api/broadcasts
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const broadcasts = await prisma.broadcastMessage.findMany({
      where: { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      orderBy: { createdAt: 'desc' },
    });
    res.json({
      success: true,
      data: broadcasts.map((broadcast) => ({
        ...broadcast,
        createdBy: broadcast.senderId,
        targetDepartment: broadcast.department,
      })),
    });
  } catch (err) { next(err); }
});

// POST /api/broadcasts
router.post('/', requireRole('admin', 'manager'), async (req: Request & { user?: { id: string; role: string } }, res: Response, next: NextFunction) => {
  try {
    const body = broadcastSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    const broadcast = await prisma.broadcastMessage.create({
      data: {
        title: body.title,
        message: body.message,
        department: body.targetDepartment || body.department,
        senderId: req.user!.id,
        senderName: user?.name || 'Admin',
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      },
    });
    getIO().emit('broadcast:new', broadcast);
    res.status(201).json({
      success: true,
      data: {
        ...broadcast,
        createdBy: broadcast.senderId,
        targetDepartment: broadcast.department,
      },
    });
  } catch (err) { next(err); }
});

// DELETE /api/broadcasts/:id
router.delete('/:id', requireRole('admin', 'manager'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.broadcastMessage.delete({ where: { id: req.params.id as string } });
    res.json({ success: true, message: 'Broadcast deleted' });
  } catch (err) { next(err); }
});

export default router;
