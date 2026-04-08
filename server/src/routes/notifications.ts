import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { verifyToken } from '../middleware/auth';

const router = Router();
router.use(verifyToken);

// GET /api/notifications
router.get('/', async (req: Request & { user?: { id: string } }, res: Response, next: NextFunction) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.id },
      orderBy: [{ read: 'asc' }, { createdAt: 'desc' }],
      take: 50,
    });
    const unreadCount = notifications.filter(n => !n.read).length;
    res.json({ success: true, data: { notifications, unreadCount } });
  } catch (err) { next(err); }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', async (req: Request & { user?: { id: string } }, res: Response, next: NextFunction) => {
  try {
    await prisma.notification.updateMany({
      where: { id: req.params.id as string, userId: req.user!.id },
      data: { read: true },
    });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// PATCH /api/notifications/read-all
router.patch('/read-all', async (req: Request & { user?: { id: string } }, res: Response, next: NextFunction) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, read: false },
      data: { read: true },
    });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// DELETE /api/notifications/:id
router.delete('/:id', async (req: Request & { user?: { id: string } }, res: Response, next: NextFunction) => {
  try {
    await prisma.notification.deleteMany({
      where: { id: req.params.id as string, userId: req.user!.id },
    });
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
