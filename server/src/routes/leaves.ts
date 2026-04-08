import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { verifyToken, requireRole } from '../middleware/auth';
import { createNotification } from '../utils/notifications';

const router = Router();

router.use(verifyToken);

// Leave allowances per type (annual days)
const LEAVE_ALLOWANCES: Record<string, number> = {
  Annual: 21,
  Sick: 14,
  Casual: 7,
  Study: 5,
  Unpaid: 30,
};

function calculateWorkingDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

const submitLeaveSchema = z.object({
  type: z.enum(['Annual', 'Sick', 'Casual', 'Study', 'Unpaid']),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().min(1),
});

// GET /api/leaves
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { status, year } = req.query as Record<string, string>;

    const leaves = await prisma.leaveRequest.findMany({
      where: {
        userId,
        ...(status ? { status: String(status) as 'pending' | 'approved' | 'rejected' } : {}),
        ...(year ? { startDate: { startsWith: String(year) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: leaves });
  } catch (error) {
    next(error);
  }
});

// POST /api/leaves
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = submitLeaveSchema.parse(req.body);
    const userId = req.user!.id;

    if (new Date(data.endDate) < new Date(data.startDate)) {
      res.status(400).json({ success: false, message: 'End date cannot be before start date' });
      return;
    }

    const days = calculateWorkingDays(data.startDate, data.endDate);

    const leave = await prisma.leaveRequest.create({
      data: {
        userId,
        type: data.type,
        startDate: data.startDate,
        endDate: data.endDate,
        days,
        reason: data.reason,
      },
    });

    // Notify managers/admins
    const managers = await prisma.user.findMany({
      where: { role: { in: ['admin', 'manager'] }, isActive: true },
      select: { id: true },
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    for (const manager of managers) {
      await createNotification(
        manager.id,
        'New Leave Request',
        `${user?.name} submitted a ${data.type} leave request for ${days} day(s).`,
        'info',
        `/admin/leaves/${leave.id}`
      );
    }

    res.status(201).json({ success: true, data: leave, message: 'Leave request submitted' });
  } catch (error) {
    next(error);
  }
});

// GET /api/leaves/all
router.get('/all', requireRole('admin', 'manager'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, type, userId } = req.query as Record<string, string>;

    const leaves = await prisma.leaveRequest.findMany({
      where: {
        ...(status ? { status: String(status) as 'pending' | 'approved' | 'rejected' } : {}),
        ...(type ? { type: String(type) as 'Annual' | 'Sick' | 'Casual' | 'Study' | 'Unpaid' } : {}),
        ...(userId ? { userId: String(userId) } : {}),
      },
      include: {
        user: {
          select: { id: true, name: true, department: true, employeeId: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: leaves });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/leaves/:id/approve
router.patch('/:id/approve', requireRole('admin', 'manager'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as Record<string, string>;

    const leave = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status: 'approved',
        approvedBy: req.user!.id,
        approvedAt: new Date(),
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    await createNotification(
      leave.userId,
      'Leave Request Approved',
      `Your ${leave.type} leave request from ${leave.startDate} to ${leave.endDate} has been approved.`,
      'success'
    );

    res.json({ success: true, data: leave, message: 'Leave approved' });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/leaves/:id/reject
router.patch('/:id/reject', requireRole('admin', 'manager'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as Record<string, string>;
    const { reviewNote } = z.object({ reviewNote: z.string().optional() }).parse(req.body);

    const leave = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status: 'rejected',
        approvedBy: req.user!.id,
        approvedAt: new Date(),
        reviewNote,
      },
    });

    await createNotification(
      leave.userId,
      'Leave Request Rejected',
      `Your ${leave.type} leave request has been rejected.${reviewNote ? ` Reason: ${reviewNote}` : ''}`,
      'error'
    );

    res.json({ success: true, data: leave, message: 'Leave rejected' });
  } catch (error) {
    next(error);
  }
});

// GET /api/leaves/balance/:userId
router.get('/balance/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params as Record<string, string>;

    if (req.user!.role === 'employee' && req.user!.id !== userId) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const currentYear = new Date().getFullYear();

    const approvedLeaves = await prisma.leaveRequest.findMany({
      where: {
        userId,
        status: 'approved',
        startDate: { startsWith: String(currentYear) },
      },
    });

    const balance: Record<string, { used: number; total: number; remaining: number }> = {};

    for (const [type, total] of Object.entries(LEAVE_ALLOWANCES)) {
      const used = approvedLeaves
        .filter((l) => l.type === type)
        .reduce((sum, l) => sum + l.days, 0);
      balance[type] = { used, total, remaining: total - used };
    }

    res.json({ success: true, data: balance });
  } catch (error) {
    next(error);
  }
});

router.get('/balance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const currentYear = new Date().getFullYear();

    const approvedLeaves = await prisma.leaveRequest.findMany({
      where: {
        userId: req.user!.id,
        status: 'approved',
        startDate: { startsWith: String(currentYear) },
      },
    });

    const data = {
      annual: LEAVE_ALLOWANCES.Annual - approvedLeaves.filter((leave) => leave.type === 'Annual').reduce((sum, leave) => sum + leave.days, 0),
      sick: LEAVE_ALLOWANCES.Sick - approvedLeaves.filter((leave) => leave.type === 'Sick').reduce((sum, leave) => sum + leave.days, 0),
      casual: LEAVE_ALLOWANCES.Casual - approvedLeaves.filter((leave) => leave.type === 'Casual').reduce((sum, leave) => sum + leave.days, 0),
    };

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// GET /api/leaves/calendar
router.get('/calendar', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { month, year } = req.query as Record<string, string>;
    const currentYear = year ? String(year) : String(new Date().getFullYear());
    const currentMonth = month ? String(month).padStart(2, '0') : String(new Date().getMonth() + 1).padStart(2, '0');

    const startOfMonth = `${currentYear}-${currentMonth}-01`;
    const endOfMonth = `${currentYear}-${currentMonth}-31`;

    const leaves = await prisma.leaveRequest.findMany({
      where: {
        status: 'approved',
        startDate: { lte: endOfMonth },
        endDate: { gte: startOfMonth },
      },
      include: {
        user: {
          select: { id: true, name: true, department: true },
        },
      },
      orderBy: { startDate: 'asc' },
    });

    res.json({ success: true, data: leaves });
  } catch (error) {
    next(error);
  }
});

export default router;
