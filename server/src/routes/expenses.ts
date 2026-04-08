import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { verifyToken, requireRole } from '../middleware/auth';
import { createNotification } from '../utils/notifications';

const router = Router();

router.use(verifyToken);

const submitExpenseSchema = z.object({
  title: z.string().min(1),
  amount: z.number().positive(),
  category: z.string().min(1),
  date: z.string(),
  description: z.string().min(1),
  receipt: z.string().optional(),
});

// GET /api/expenses
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { status, month, year } = req.query as Record<string, string>;

    const expenses = await prisma.expenseRequest.findMany({
      where: {
        userId,
        ...(status ? { status: String(status) as 'pending' | 'approved' | 'rejected' } : {}),
        ...(month && year
          ? { date: { startsWith: `${year}-${String(month).padStart(2, '0')}` } }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: expenses });
  } catch (error) {
    next(error);
  }
});

// POST /api/expenses
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = submitExpenseSchema.parse(req.body);
    const userId = req.user!.id;

    const expense = await prisma.expenseRequest.create({
      data: {
        userId,
        ...data,
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
        'New Expense Request',
        `${user?.name} submitted an expense request: ${data.title} (₦${data.amount.toLocaleString()})`,
        'info',
        `/admin/expenses/${expense.id}`
      );
    }

    res.status(201).json({ success: true, data: expense, message: 'Expense request submitted' });
  } catch (error) {
    next(error);
  }
});

// GET /api/expenses/all
router.get('/all', requireRole('admin', 'manager'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, category, userId, month, year } = req.query as Record<string, string>;

    const expenses = await prisma.expenseRequest.findMany({
      where: {
        ...(status ? { status: String(status) as 'pending' | 'approved' | 'rejected' } : {}),
        ...(category ? { category: String(category) } : {}),
        ...(userId ? { userId: String(userId) } : {}),
        ...(month && year
          ? { date: { startsWith: `${year}-${String(month).padStart(2, '0')}` } }
          : {}),
      },
      include: {
        user: {
          select: { id: true, name: true, department: true, employeeId: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: expenses });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/expenses/:id/approve
router.patch('/:id/approve', requireRole('admin', 'manager'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as Record<string, string>;

    const expense = await prisma.expenseRequest.update({
      where: { id },
      data: {
        status: 'approved',
        approvedBy: req.user!.id,
        approvedAt: new Date(),
      },
    });

    await createNotification(
      expense.userId,
      'Expense Approved',
      `Your expense request "${expense.title}" (₦${expense.amount.toLocaleString()}) has been approved.`,
      'success'
    );

    res.json({ success: true, data: expense, message: 'Expense approved' });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/expenses/:id/reject
router.patch('/:id/reject', requireRole('admin', 'manager'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as Record<string, string>;
    const { reviewNote } = z.object({ reviewNote: z.string().optional() }).parse(req.body);

    const expense = await prisma.expenseRequest.update({
      where: { id },
      data: {
        status: 'rejected',
        approvedBy: req.user!.id,
        approvedAt: new Date(),
        reviewNote,
      },
    });

    await createNotification(
      expense.userId,
      'Expense Rejected',
      `Your expense request "${expense.title}" has been rejected.${reviewNote ? ` Reason: ${reviewNote}` : ''}`,
      'error'
    );

    res.json({ success: true, data: expense, message: 'Expense rejected' });
  } catch (error) {
    next(error);
  }
});

// GET /api/expenses/summary/:userId/:month/:year
router.get('/summary/:userId/:month/:year', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, month, year } = req.params as Record<string, string>;

    if (req.user!.role === 'employee' && req.user!.id !== userId) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const monthStr = month.padStart(2, '0');
    const datePrefix = `${year}-${monthStr}`;

    const expenses = await prisma.expenseRequest.findMany({
      where: { userId, date: { startsWith: datePrefix } },
      orderBy: { date: 'asc' },
    });

    const summary = {
      total: expenses.reduce((sum, e) => sum + e.amount, 0),
      approved: expenses.filter((e) => e.status === 'approved').reduce((sum, e) => sum + e.amount, 0),
      pending: expenses.filter((e) => e.status === 'pending').reduce((sum, e) => sum + e.amount, 0),
      rejected: expenses.filter((e) => e.status === 'rejected').reduce((sum, e) => sum + e.amount, 0),
      byCategory: expenses.reduce(
        (acc, e) => {
          acc[e.category] = (acc[e.category] || 0) + e.amount;
          return acc;
        },
        {} as Record<string, number>
      ),
      count: expenses.length,
      expenses,
    };

    res.json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
});

router.get('/summary', requireRole('admin', 'manager'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { month, year } = req.query as Record<string, string>;
    const now = new Date();
    const monthValue = String(month || now.getMonth() + 1).padStart(2, '0');
    const yearValue = String(year || now.getFullYear());
    const prefix = `${yearValue}-${monthValue}`;

    const expenses = await prisma.expenseRequest.findMany({
      where: { date: { startsWith: prefix } },
    });

    const summary = Object.entries(
      expenses.reduce((accumulator, expense) => {
        accumulator[expense.category] = (accumulator[expense.category] || 0) + expense.amount;
        return accumulator;
      }, {} as Record<string, number>)
    ).map(([category, total]) => ({ category, total }));

    res.json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
});

export default router;
