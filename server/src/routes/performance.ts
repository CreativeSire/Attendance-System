import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { verifyToken, requireRole } from '../middleware/auth';

const router = Router();

router.use(verifyToken);

router.get('/my-goals', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { quarter, year } = req.query as Record<string, string>;
    const goals = await prisma.performanceGoal.findMany({
      where: {
        userId: req.user!.id,
        ...(quarter ? { quarter: parseInt(String(quarter).replace('Q', ''), 10) } : {}),
        ...(year ? { year: parseInt(year, 10) } : {}),
      },
      orderBy: [{ year: 'desc' }, { quarter: 'desc' }],
    });

    res.json({ success: true, data: goals });
  } catch (error) {
    next(error);
  }
});

router.get('/team-goals', requireRole('admin', 'manager'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, quarter, year } = req.query as Record<string, string>;
    const goals = await prisma.performanceGoal.findMany({
      where: {
        ...(userId ? { userId } : {}),
        ...(quarter ? { quarter: parseInt(String(quarter).replace('Q', ''), 10) } : {}),
        ...(year ? { year: parseInt(year, 10) } : {}),
      },
      include: {
        user: {
          select: { id: true, name: true, department: true },
        },
      },
      orderBy: [{ year: 'desc' }, { quarter: 'desc' }],
    });

    res.json({ success: true, data: goals });
  } catch (error) {
    next(error);
  }
});

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

const createGoalSchema = z.object({
  userId: z.string().optional(),
  quarter: z.number().int().min(1).max(4),
  year: z.number().int(),
  objective: z.string().min(1),
  keyResultOne: z.string().optional(),
  keyResultTwo: z.string().optional(),
  keyResultThree: z.string().optional(),
  progressPercent: z.number().int().min(0).max(100).default(0),
});

const updateGoalSchema = z.object({
  objective: z.string().min(1).optional(),
  keyResultOne: z.string().optional(),
  keyResultTwo: z.string().optional(),
  keyResultThree: z.string().optional(),
  progressPercent: z.number().int().min(0).max(100).optional(),
  managerNotes: z.string().optional(),
  status: z.string().optional(),
});

// GET /api/performance/goals/:userId
router.get('/goals/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params as Record<string, string>;
    const { quarter, year } = req.query as Record<string, string>;

    if (req.user!.role === 'employee' && req.user!.id !== userId) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const goals = await prisma.performanceGoal.findMany({
      where: {
        userId,
        ...(quarter ? { quarter: parseInt(String(quarter)) } : {}),
        ...(year ? { year: parseInt(String(year)) } : {}),
      },
      orderBy: [{ year: 'desc' }, { quarter: 'desc' }],
    });

    res.json({ success: true, data: goals });
  } catch (error) {
    next(error);
  }
});

// POST /api/performance/goals
router.post('/goals', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createGoalSchema.parse(req.body);
    const userId = data.userId || req.user!.id;

    if (req.user!.role === 'employee' && req.user!.id !== userId) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const goal = await prisma.performanceGoal.create({
      data: {
        userId,
        quarter: data.quarter,
        year: data.year,
        objective: data.objective,
        keyResultOne: data.keyResultOne,
        keyResultTwo: data.keyResultTwo,
        keyResultThree: data.keyResultThree,
        progressPercent: data.progressPercent,
      },
    });

    res.status(201).json({ success: true, data: goal, message: 'Goal created successfully' });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/performance/goals/:id
router.patch('/goals/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as Record<string, string>;
    const data = updateGoalSchema.parse(req.body);

    const goal = await prisma.performanceGoal.findUniqueOrThrow({ where: { id } });

    if (req.user!.role === 'employee' && req.user!.id !== goal.userId) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    // Only admin/manager can set managerNotes
    const updateData = { ...data };
    if (req.user!.role === 'employee') {
      delete updateData.managerNotes;
    }

    const updated = await prisma.performanceGoal.update({
      where: { id },
      data: updateData,
    });

    res.json({ success: true, data: updated, message: 'Goal updated' });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/performance/goals/:id
router.delete('/goals/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as Record<string, string>;

    const goal = await prisma.performanceGoal.findUniqueOrThrow({ where: { id } });

    if (req.user!.role === 'employee' && req.user!.id !== goal.userId) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    await prisma.performanceGoal.delete({ where: { id } });

    res.json({ success: true, message: 'Goal deleted' });
  } catch (error) {
    next(error);
  }
});

// GET /api/performance/score/:userId
router.get('/score/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params as Record<string, string>;

    if (req.user!.role === 'employee' && req.user!.id !== userId) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const monthStr = currentMonth.toString().padStart(2, '0');
    const datePrefix = `${currentYear}-${monthStr}`;

    // Attendance records for this month
    const attendance = await prisma.attendanceRecord.findMany({
      where: { userId, date: { startsWith: datePrefix } },
    });

    // BDD submissions for this week
    const weekNumber = getWeekNumber(now);
    const bddThisWeek = await prisma.bDDCheckIn.findMany({
      where: { userId, weekNumber, year: currentYear },
    });

    // Calculate attendance rate
    const workingDaysElapsed = attendance.length;
    const presentDays = attendance.filter((a) => a.status !== 'absent').length;
    const attendanceRate = workingDaysElapsed > 0 ? (presentDays / workingDaysElapsed) * 100 : 100;

    // On-time rate
    const lateDays = attendance.filter((a) => a.isLate).length;
    const onTimeRate = workingDaysElapsed > 0
      ? ((workingDaysElapsed - lateDays) / workingDaysElapsed) * 100
      : 100;

    // BDD completion rate (5 working days per week)
    const expectedBDDThisWeek = Math.min(5, now.getDay() === 0 ? 5 : now.getDay());
    const bddCompletionRate = expectedBDDThisWeek > 0
      ? (bddThisWeek.length / expectedBDDThisWeek) * 100
      : 100;

    // Goal progress average (current quarter)
    const currentQuarter = Math.ceil(currentMonth / 3);
    const goals = await prisma.performanceGoal.findMany({
      where: { userId, quarter: currentQuarter, year: currentYear, status: 'active' },
    });
    const goalProgressAvg = goals.length > 0
      ? goals.reduce((sum, g) => sum + g.progressPercent, 0) / goals.length
      : 0;

    // Overall score (weighted average)
    const overallScore = Math.round(
      attendanceRate * 0.3 + onTimeRate * 0.3 + bddCompletionRate * 0.2 + goalProgressAvg * 0.2
    );

    const score = {
      userId,
      attendanceRate: Math.round(attendanceRate),
      onTimeRate: Math.round(onTimeRate),
      bddCompletionRate: Math.round(bddCompletionRate),
      goalProgressAverage: Math.round(goalProgressAvg),
      overallScore,
      details: {
        presentDays,
        totalDays: workingDaysElapsed,
        lateDays,
        bddSubmissionsThisWeek: bddThisWeek.length,
        activeGoals: goals.length,
      },
    };

    res.json({ success: true, data: score });
  } catch (error) {
    next(error);
  }
});

router.get('/my-score', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const monthStr = currentMonth.toString().padStart(2, '0');
    const datePrefix = `${currentYear}-${monthStr}`;
    const weekNumber = getWeekNumber(now);
    const currentQuarter = Math.ceil(currentMonth / 3);

    const [attendance, bddCount, goals] = await Promise.all([
      prisma.attendanceRecord.findMany({
        where: { userId: req.user!.id, date: { startsWith: datePrefix } },
      }),
      prisma.bDDCheckIn.count({
        where: { userId: req.user!.id, weekNumber, year: currentYear },
      }),
      prisma.performanceGoal.findMany({
        where: { userId: req.user!.id, quarter: currentQuarter, year: currentYear, status: 'active' },
      }),
    ]);

    const presentDays = attendance.filter((record) => record.status !== 'absent').length;
    const lateDays = attendance.filter((record) => record.isLate).length;
    const attendanceRate = attendance.length > 0 ? (presentDays / attendance.length) * 100 : 0;
    const avgProgressScore = 0;
    const okrProgress = goals.length > 0
      ? goals.reduce((sum, goal) => sum + goal.progressPercent, 0) / goals.length
      : 0;
    const expectedBDD = Math.min(5, now.getDay() === 0 ? 5 : now.getDay());
    const bddCompletionRate = expectedBDD > 0 ? (bddCount / expectedBDD) * 100 : 0;
    const overallScore = attendanceRate * 0.4 + bddCompletionRate * 0.3 + okrProgress * 0.3;

    res.json({
      success: true,
      data: {
        attendanceRate,
        lateDays,
        presentDays,
        avgProgressScore,
        okrProgress,
        bddCompletionRate,
        overallScore,
        streak: bddCount,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/performance/team-scores
router.get('/team-scores', requireRole('admin', 'manager'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employees = await prisma.user.findMany({
      where: { isActive: true, role: { not: 'admin' } },
      select: { id: true, name: true, department: true, employeeId: true },
    });

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const monthStr = currentMonth.toString().padStart(2, '0');
    const datePrefix = `${currentYear}-${monthStr}`;
    const weekNumber = getWeekNumber(now);
    const currentQuarter = Math.ceil(currentMonth / 3);

    const teamScores = await Promise.all(
      employees.map(async (emp) => {
        const attendance = await prisma.attendanceRecord.findMany({
          where: { userId: emp.id, date: { startsWith: datePrefix } },
        });

        const bddThisWeek = await prisma.bDDCheckIn.count({
          where: { userId: emp.id, weekNumber, year: currentYear },
        });

        const goals = await prisma.performanceGoal.findMany({
          where: { userId: emp.id, quarter: currentQuarter, year: currentYear, status: 'active' },
        });

        const workingDaysElapsed = attendance.length;
        const presentDays = attendance.filter((a) => a.status !== 'absent').length;
        const lateDays = attendance.filter((a) => a.isLate).length;

        const attendanceRate = workingDaysElapsed > 0 ? (presentDays / workingDaysElapsed) * 100 : 100;
        const onTimeRate = workingDaysElapsed > 0
          ? ((workingDaysElapsed - lateDays) / workingDaysElapsed) * 100
          : 100;
        const expectedBDD = Math.min(5, now.getDay() === 0 ? 5 : now.getDay());
        const bddRate = expectedBDD > 0 ? (bddThisWeek / expectedBDD) * 100 : 100;
        const goalAvg = goals.length > 0
          ? goals.reduce((sum, g) => sum + g.progressPercent, 0) / goals.length
          : 0;

        const overallScore = Math.round(
          attendanceRate * 0.3 + onTimeRate * 0.3 + bddRate * 0.2 + goalAvg * 0.2
        );

        return {
          ...emp,
          attendanceRate: Math.round(attendanceRate),
          onTimeRate: Math.round(onTimeRate),
          bddCompletionRate: Math.round(bddRate),
          goalProgressAverage: Math.round(goalAvg),
          overallScore,
        };
      })
    );

    const sorted = teamScores.sort((a, b) => b.overallScore - a.overallScore);

    res.json({ success: true, data: sorted });
  } catch (error) {
    next(error);
  }
});

router.get('/team', requireRole('admin', 'manager'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employees = await prisma.user.findMany({
      where: { isActive: true, role: { not: 'admin' } },
      select: { id: true, name: true, department: true, employeeId: true },
    });

    const scores = await Promise.all(
      employees.map(async (employee) => {
        const scoreResult = await prisma.performanceGoal.findMany({
          where: { userId: employee.id, status: 'active' },
        });
        const progress = scoreResult.length
          ? scoreResult.reduce((sum, goal) => sum + goal.progressPercent, 0) / scoreResult.length
          : 0;

        return {
          userId: employee.id,
          user: { name: employee.name, department: employee.department || 'General' },
          attendanceRate: 0,
          bddCompletionRate: 0,
          avgProgressScore: progress,
          okrProgress: progress,
          overallScore: progress,
        };
      })
    );

    res.json({ success: true, data: scores });
  } catch (error) {
    next(error);
  }
});

export default router;
