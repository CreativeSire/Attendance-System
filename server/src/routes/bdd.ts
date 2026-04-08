import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { verifyToken, requireRole } from '../middleware/auth';

const router = Router();

router.use(verifyToken);

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getDayName(date: Date): string {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
}

const bddSchema = z.object({
  userId: z.string().optional(),
  // Monday fields
  weeklyGoal: z.string().optional(),
  lastWeekAccomplishment: z.string().optional(),
  foreseenChallenges: z.string().optional(),
  supportNeeded: z.string().optional(),
  seMeetingFeedback: z.string().optional(),
  // Daily fields
  priorityOne: z.string().optional(),
  priorityTwo: z.string().optional(),
  priorityThree: z.string().optional(),
  completedYesterday: z.string().optional(),
  blockers: z.string().optional(),
  progressPercent: z.number().int().min(0).max(100).optional(),
  questionsNotes: z.string().optional(),
  // Saturday fields
  goalAchieved: z.string().optional(),
  keyWins: z.string().optional(),
  aiUsageThisWeek: z.string().optional(),
  wouldDoDifferently: z.string().optional(),
  // Optional override date (for testing)
  date: z.string().optional(),
  // Frontend aliases
  mondayPriority1: z.string().optional(),
  mondayPriority2: z.string().optional(),
  mondayPriority3: z.string().optional(),
  resourcesNeeded: z.string().optional(),
  potentialBlockers: z.string().optional(),
  progressScore: z.number().int().min(0).max(100).optional(),
  todayPriority1: z.string().optional(),
  todayPriority2: z.string().optional(),
  todayPriority3: z.string().optional(),
  weeklyAchievement: z.string().optional(),
  aiUsage: z.string().optional(),
  nextWeekPriorities: z.string().optional(),
});

// POST /api/bdd
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = bddSchema.parse(req.body);
    const userId = data.userId || req.user!.id;

    if (req.user!.role === 'employee' && req.user!.id !== userId) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const now = new Date();
    const dateStr = data.date || now.toISOString().split('T')[0];
    const dateObj = new Date(dateStr);
    const dayOfWeek = getDayName(dateObj);
    const weekNumber = getWeekNumber(dateObj);
    const year = dateObj.getFullYear();

    // Only one BDD per user per date
    const existing = await prisma.bDDCheckIn.findFirst({
      where: { userId, date: dateStr },
    });

    if (existing) {
      res.status(400).json({ success: false, message: 'BDD already submitted for today' });
      return;
    }

    const checkin = await prisma.bDDCheckIn.create({
      data: {
        userId,
        date: dateStr,
        dayOfWeek,
        weekNumber,
        year,
        weeklyGoal: data.weeklyGoal,
        lastWeekAccomplishment: data.lastWeekAccomplishment,
        foreseenChallenges: data.foreseenChallenges || data.potentialBlockers,
        supportNeeded: data.supportNeeded || data.resourcesNeeded,
        seMeetingFeedback: data.seMeetingFeedback,
        priorityOne: data.priorityOne || data.todayPriority1 || data.mondayPriority1,
        priorityTwo: data.priorityTwo || data.todayPriority2 || data.mondayPriority2,
        priorityThree: data.priorityThree || data.todayPriority3 || data.mondayPriority3,
        completedYesterday: data.completedYesterday,
        blockers: data.blockers,
        progressPercent: data.progressPercent || data.progressScore,
        questionsNotes: data.questionsNotes,
        goalAchieved: data.goalAchieved || data.weeklyAchievement,
        keyWins: data.keyWins,
        aiUsageThisWeek: data.aiUsageThisWeek || data.aiUsage,
        wouldDoDifferently: data.wouldDoDifferently || data.nextWeekPriorities,
      },
    });

    res.status(201).json({
      success: true,
      data: checkin,
      message: 'BDD check-in submitted successfully',
    });
  } catch (error) {
    next(error);
  }
});

router.get('/today', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const checkin = await prisma.bDDCheckIn.findFirst({
      where: { userId: req.user!.id, date: today },
    });
    res.json({ success: true, data: checkin || null });
  } catch (error) {
    next(error);
  }
});

router.get('/my', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { month, year } = req.query as Record<string, string>;
    const checkins = await prisma.bDDCheckIn.findMany({
      where: {
        userId: req.user!.id,
        ...(month && year ? { date: { startsWith: `${year}-${String(month).padStart(2, '0')}` } } : {}),
      },
      orderBy: { date: 'desc' },
    });
    res.json({ success: true, data: checkins });
  } catch (error) {
    next(error);
  }
});

// GET /api/bdd/today/:userId
router.get('/today/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params as Record<string, string>;

    if (req.user!.role === 'employee' && req.user!.id !== userId) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const checkin = await prisma.bDDCheckIn.findFirst({
      where: { userId, date: today },
    });

    res.json({ success: true, data: checkin || null });
  } catch (error) {
    next(error);
  }
});

// GET /api/bdd/user/:userId
router.get('/user/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params as Record<string, string>;
    const { week, year } = req.query as Record<string, string>;

    if (req.user!.role === 'employee' && req.user!.id !== userId) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const checkins = await prisma.bDDCheckIn.findMany({
      where: {
        userId,
        ...(week && year
          ? { weekNumber: parseInt(String(week)), year: parseInt(String(year)) }
          : {}),
      },
      orderBy: { date: 'desc' },
    });

    res.json({ success: true, data: checkins });
  } catch (error) {
    next(error);
  }
});

// GET /api/bdd/team
router.get('/team', requireRole('admin', 'manager'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const weekNumber = getWeekNumber(now);
    const year = now.getFullYear();

    const checkins = await prisma.bDDCheckIn.findMany({
      where: { weekNumber, year },
      include: {
        user: {
          select: { id: true, name: true, department: true, employeeId: true },
        },
      },
      orderBy: [{ userId: 'asc' }, { date: 'asc' }],
    });

    res.json({ success: true, data: checkins });
  } catch (error) {
    next(error);
  }
});

router.get('/completion-rate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { month, year } = req.query as Record<string, string>;
    const prefix = month && year ? `${year}-${String(month).padStart(2, '0')}` : new Date().toISOString().slice(0, 7);

    const [attendanceCount, bddCount] = await Promise.all([
      prisma.attendanceRecord.count({
        where: { userId: req.user!.id, date: { startsWith: prefix } },
      }),
      prisma.bDDCheckIn.count({
        where: { userId: req.user!.id, date: { startsWith: prefix } },
      }),
    ]);

    res.json({
      success: true,
      data: {
        completed: bddCount,
        total: attendanceCount,
        rate: attendanceCount > 0 ? Math.round((bddCount / attendanceCount) * 100) : 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/bdd/team-brief
router.get('/team-brief', requireRole('admin', 'manager'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const weekNumber = getWeekNumber(now);
    const year = now.getFullYear();

    const checkins = await prisma.bDDCheckIn.findMany({
      where: { weekNumber, year },
      include: {
        user: {
          select: { id: true, name: true, department: true },
        },
      },
      orderBy: { userId: 'asc' },
    });

    // Group by user
    const byUser: Record<string, {
      user: { id: string; name: string; department: string | null };
      weeklyGoal: string | null;
      priorities: string[];
      blockers: string[];
      progressPercent: number | null;
      daysSubmitted: number;
    }> = {};

    for (const c of checkins) {
      if (!byUser[c.userId]) {
        byUser[c.userId] = {
          user: c.user,
          weeklyGoal: c.weeklyGoal,
          priorities: [],
          blockers: [],
          progressPercent: null,
          daysSubmitted: 0,
        };
      }
      if (c.priorityOne) byUser[c.userId].priorities.push(c.priorityOne);
      if (c.priorityTwo) byUser[c.userId].priorities.push(c.priorityTwo);
      if (c.priorityThree) byUser[c.userId].priorities.push(c.priorityThree);
      if (c.blockers) byUser[c.userId].blockers.push(c.blockers);
      if (c.progressPercent !== null) byUser[c.userId].progressPercent = c.progressPercent;
      byUser[c.userId].daysSubmitted++;
    }

    const brief = {
      week: weekNumber,
      year,
      generatedAt: now.toISOString(),
      teamSummary: Object.values(byUser),
      totalSubmissions: checkins.length,
      uniqueEmployees: Object.keys(byUser).length,
    };

    res.json({ success: true, data: brief });
  } catch (error) {
    next(error);
  }
});

// GET /api/bdd/missing/:date
router.get('/missing/:date', requireRole('admin', 'manager'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date } = req.params as Record<string, string>;

    // Find all who clocked in on this date
    const clockedIn = await prisma.attendanceRecord.findMany({
      where: { date },
      select: { userId: true },
    });
    const clockedInIds = clockedIn.map((r) => r.userId);

    // Find who submitted BDD
    const submitted = await prisma.bDDCheckIn.findMany({
      where: { date },
      select: { userId: true },
    });
    const submittedIds = new Set(submitted.map((s) => s.userId));

    // Missing = clocked in but didn't submit BDD
    const missingIds = clockedInIds.filter((id) => !submittedIds.has(id));

    const missingUsers = await prisma.user.findMany({
      where: { id: { in: missingIds } },
      select: { id: true, name: true, department: true, employeeId: true, email: true },
    });

    res.json({ success: true, data: missingUsers });
  } catch (error) {
    next(error);
  }
});

export default router;
