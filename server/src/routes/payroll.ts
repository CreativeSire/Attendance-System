import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { verifyToken, requireRole } from '../middleware/auth';
import { calculatePayroll } from '../utils/payroll';

const router = Router();

router.use(verifyToken);

router.get('/my', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { month, year } = req.query as Record<string, string>;
    const now = new Date();
    const monthValue = parseInt(month || String(now.getMonth() + 1), 10);
    const yearValue = parseInt(year || String(now.getFullYear()), 10);
    const payroll = await calculatePayroll(req.user!.id, monthValue, yearValue, prisma);
    res.json({ success: true, data: payroll });
  } catch (error) {
    next(error);
  }
});

router.get('/team', requireRole('admin', 'manager'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { month, year } = req.query as Record<string, string>;
    const now = new Date();
    const monthValue = parseInt(month || String(now.getMonth() + 1), 10);
    const yearValue = parseInt(year || String(now.getFullYear()), 10);
    const employees = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    const payrolls = await Promise.all(
      employees.map((employee) => calculatePayroll(employee.id, monthValue, yearValue, prisma))
    );

    res.json({ success: true, data: payrolls });
  } catch (error) {
    next(error);
  }
});

// GET /api/payroll/calculate/:userId/:month/:year
router.get('/calculate/:userId/:month/:year', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, month, year } = req.params as Record<string, string>;

    if (req.user!.role === 'employee' && req.user!.id !== userId) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const result = await calculatePayroll(userId, parseInt(month), parseInt(year), prisma);

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// GET /api/payroll/team/:month/:year
router.get('/team/:month/:year', requireRole('admin', 'manager'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { month, year } = req.params as Record<string, string>;

    const employees = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    const results = await Promise.allSettled(
      employees.map((e) => calculatePayroll(e.id, parseInt(month), parseInt(year), prisma))
    );

    const payrolls = results
      .filter((r) => r.status === 'fulfilled')
      .map((r) => (r as PromiseFulfilledResult<ReturnType<typeof calculatePayroll> extends Promise<infer T> ? T : never>).value);

    const failed = results
      .filter((r) => r.status === 'rejected')
      .length;

    const teamSummary = {
      month: parseInt(month),
      year: parseInt(year),
      totalEmployees: employees.length,
      processed: payrolls.length,
      failed,
      totalGrossPay: payrolls.reduce((sum, p) => sum + p.grossPay, 0),
      totalNetPay: payrolls.reduce((sum, p) => sum + p.netPay, 0),
      totalDeductions: payrolls.reduce((sum, p) => sum + p.totalDeductions, 0),
      payrolls,
    };

    res.json({ success: true, data: teamSummary });
  } catch (error) {
    next(error);
  }
});

// GET /api/payroll/payslip/:userId/:month/:year
router.get('/payslip/:userId/:month/:year', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, month, year } = req.params as Record<string, string>;

    if (req.user!.role === 'employee' && req.user!.id !== userId) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const payroll = await calculatePayroll(userId, parseInt(month), parseInt(year), prisma);

    const monthNames = [
      '', 'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];

    const payslip = {
      ...payroll,
      monthName: monthNames[parseInt(month)],
      generatedAt: new Date().toISOString(),
      companyName: 'Dala Workforce Intelligence',
      payslipId: `PS-${userId.slice(-6).toUpperCase()}-${year}${month.padStart(2, '0')}`,
    };

    res.json({ success: true, data: payslip });
  } catch (error) {
    next(error);
  }
});

export default router;
