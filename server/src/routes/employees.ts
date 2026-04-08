import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { verifyToken, requireRole } from '../middleware/auth';

const router = Router();

router.use(verifyToken);

const createEmployeeSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['admin', 'manager', 'employee']).default('employee'),
  department: z.string().optional(),
  employeeId: z.string().optional(),
  position: z.string().optional(),
  hourlyRate: z.number().default(0),
  basicSalary: z.number().default(0),
  phone: z.string().optional(),
  startDate: z.string().optional(),
});

const updateEmployeeSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(['admin', 'manager', 'employee']).optional(),
  department: z.string().optional(),
  position: z.string().optional(),
  hourlyRate: z.number().optional(),
  basicSalary: z.number().optional(),
  phone: z.string().optional(),
  masterPhoto: z.string().optional(),
});

router.get('/departments', requireRole('admin', 'manager'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await prisma.user.findMany({
      where: { isActive: true, department: { not: null } },
      select: { department: true },
      distinct: ['department'],
      orderBy: { department: 'asc' },
    });

    res.json({
      success: true,
      data: result.map((row) => row.department).filter(Boolean),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/employees
router.get('/', requireRole('admin', 'manager'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { department, search } = req.query as Record<string, string>;

    const employees = await prisma.user.findMany({
      where: {
        isActive: true,
        ...(department ? { department: String(department) } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: String(search), mode: 'insensitive' } },
                { email: { contains: String(search), mode: 'insensitive' } },
                { employeeId: { contains: String(search), mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        employeeId: true,
        position: true,
        hourlyRate: true,
        basicSalary: true,
        phone: true,
        startDate: true,
        masterPhoto: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    });

    res.json({ success: true, data: employees });
  } catch (error) {
    next(error);
  }
});

// GET /api/employees/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as Record<string, string>;

    // Employees can only view their own profile unless admin/manager
    if (req.user!.role === 'employee' && req.user!.id !== id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const employee = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        employeeId: true,
        position: true,
        hourlyRate: true,
        basicSalary: true,
        phone: true,
        startDate: true,
        masterPhoto: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!employee) {
      res.status(404).json({ success: false, message: 'Employee not found' });
      return;
    }

    res.json({ success: true, data: employee });
  } catch (error) {
    next(error);
  }
});

// POST /api/employees
router.post('/', requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createEmployeeSchema.parse(req.body);

    const hashedPassword = await bcrypt.hash(data.password, 12);

    // Auto-generate employeeId if not provided
    let employeeId = data.employeeId;
    if (!employeeId) {
      const count = await prisma.user.count();
      employeeId = `EMP${String(count + 1).padStart(3, '0')}`;
    }

    const employee = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        role: data.role,
        department: data.department,
        employeeId,
        position: data.position,
        hourlyRate: data.hourlyRate,
        basicSalary: data.basicSalary,
        phone: data.phone,
        startDate: data.startDate ? new Date(data.startDate) : new Date(),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        employeeId: true,
        position: true,
        hourlyRate: true,
        basicSalary: true,
        phone: true,
        startDate: true,
        isActive: true,
        createdAt: true,
      },
    });

    res.status(201).json({ success: true, data: employee, message: 'Employee created successfully' });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/employees/:id
router.patch('/:id', requireRole('admin', 'manager'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as Record<string, string>;
    const data = updateEmployeeSchema.parse(req.body);

    const employee = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        employeeId: true,
        position: true,
        hourlyRate: true,
        basicSalary: true,
        phone: true,
        startDate: true,
        masterPhoto: true,
        isActive: true,
      },
    });

    res.json({ success: true, data: employee, message: 'Employee updated successfully' });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/employees/:id/photo
router.patch('/:id/photo', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as Record<string, string>;

    if (req.user!.role === 'employee' && req.user!.id !== id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const { photo } = z.object({ photo: z.string() }).parse(req.body);

    const employee = await prisma.user.update({
      where: { id },
      data: { masterPhoto: photo },
      select: { id: true, masterPhoto: true },
    });

    res.json({ success: true, data: employee, message: 'Photo updated' });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/employees/:id/password
router.patch('/:id/password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as Record<string, string>;

    if (req.user!.role === 'employee' && req.user!.id !== id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const schema = z.object({
      currentPassword: z.string().optional(),
      newPassword: z.string().min(6),
    });
    const { currentPassword, newPassword } = schema.parse(req.body);

    const user = await prisma.user.findUniqueOrThrow({ where: { id } });

    // If not admin, verify current password
    if (req.user!.role !== 'admin') {
      if (!currentPassword) {
        res.status(400).json({ success: false, message: 'Current password required' });
        return;
      }
      const match = await bcrypt.compare(currentPassword, user.password);
      if (!match) {
        res.status(401).json({ success: false, message: 'Current password incorrect' });
        return;
      }
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id }, data: { password: hashedPassword } });

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/employees/:id (soft delete)
router.delete('/:id', requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as Record<string, string>;

    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({ success: true, message: 'Employee deactivated successfully' });
  } catch (error) {
    next(error);
  }
});

// GET /api/employees/:id/stats
router.get('/:id/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as Record<string, string>;

    if (req.user!.role === 'employee' && req.user!.id !== id) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    const attendance = await prisma.attendanceRecord.findMany({
      where: { userId: id },
      orderBy: { date: 'asc' },
    });

    const totalPresent = attendance.filter((a) => a.status !== 'absent').length;
    const totalLate = attendance.filter((a) => a.isLate).length;

    const leaves = await prisma.leaveRequest.findMany({
      where: { userId: id, status: 'approved' },
    });
    const totalLeaveDays = leaves.reduce((sum, l) => sum + l.days, 0);

    // Calculate current attendance streak
    let streak = 0;
    const today = new Date();
    let checkDate = new Date(today);
    checkDate.setHours(0, 0, 0, 0);

    for (let i = 0; i < 365; i++) {
      const dayOfWeek = checkDate.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        checkDate.setDate(checkDate.getDate() - 1);
        continue;
      }

      const dateStr = checkDate.toISOString().split('T')[0];
      const record = attendance.find((a) => a.date === dateStr);

      if (!record || record.status === 'absent') {
        break;
      }
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }

    res.json({
      success: true,
      data: {
        totalPresent,
        totalLate,
        totalLeaveDays,
        currentStreak: streak,
        totalRecords: attendance.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
