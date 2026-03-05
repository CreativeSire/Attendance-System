const express = require('express');
const { PrismaClient } = require('@prisma/client');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');

dotenv.config();

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(morgan('dev'));

// Auth Endpoints
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user && password === 'password123') { // Simple prototype password
      res.json(user);
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/employees', async (req, res) => {
  try {
    const employees = await prisma.user.findMany();
    res.json(employees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/employees/:id/photo', async (req, res) => {
  const { id } = req.params;
  const { photo } = req.body;
  try {
    const user = await prisma.user.update({
      where: { id },
      data: { masterPhoto: photo }
    });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Attendance Endpoints
app.get('/api/attendance/today/:userId', async (req, res) => {
  const { userId } = req.params;
  const today = new Date().toISOString().split('T')[0];
  try {
    const record = await prisma.attendanceRecord.findFirst({
      where: { userId, date: today }
    });
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/attendance/clock-in', async (req, res) => {
  const { userId, userName, location, method, photo, mood, lateReason, isLate, lateMinutes } = req.body;
  const today = new Date().toISOString().split('T')[0];
  const timeStr = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  try {
    const record = await prisma.attendanceRecord.create({
      data: {
        userId,
        userName,
        date: today,
        clockInTime: timeStr,
        clockInLat: location.lat,
        clockInLng: location.lng,
        clockInMethod: method,
        clockInPhoto: photo,
        status: isLate ? 'late' : 'present',
        isLate,
        lateMinutes,
        lateReason,
        mood
      }
    });
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/attendance/clock-out', async (req, res) => {
  const { userId, location, method, photo, totalHours } = req.body;
  const today = new Date().toISOString().split('T')[0];
  const timeStr = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  try {
    const record = await prisma.attendanceRecord.updateMany({
      where: { userId, date: today },
      data: {
        clockOutTime: timeStr,
        clockOutLat: location.lat,
        clockOutLng: location.lng,
        clockOutMethod: method,
        clockOutPhoto: photo,
        totalHours
      }
    });
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/attendance/user/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const records = await prisma.attendanceRecord.findMany({
      where: { userId },
      orderBy: { date: 'desc' }
    });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/attendance/all', async (req, res) => {
  try {
    const records = await prisma.attendanceRecord.findMany({
      orderBy: { date: 'desc' }
    });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Leave Endpoints
app.post('/api/leaves', async (req, res) => {
  const { userId, type, startDate, endDate, reason } = req.body;
  try {
    const leave = await prisma.leaveRequest.create({
      data: { userId, type, startDate, endDate, reason }
    });
    res.json(leave);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/leaves/all', async (req, res) => {
  try {
    const leaves = await prisma.leaveRequest.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(leaves);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Expense Endpoints
app.post('/api/expenses', async (req, res) => {
  const { userId, userName, title, amount, category, date, description, receipt } = req.body;
  try {
    const expense = await prisma.expenseRequest.create({
      data: { userId, userName, title, amount, category, date, description, receipt }
    });
    res.json(expense);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/expenses/all', async (req, res) => {
  try {
    const expenses = await prisma.expenseRequest.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Broadcast Endpoints
app.post('/api/broadcasts', async (req, res) => {
  const { senderName, message, expiresAt } = req.body;
  try {
    const broadcast = await prisma.broadcastMessage.create({
      data: { senderName, message, expiresAt: new Date(expiresAt) }
    });
    res.json(broadcast);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/broadcasts/all', async (req, res) => {
  try {
    const broadcasts = await prisma.broadcastMessage.findMany({
      where: { expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(broadcasts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/broadcasts/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.broadcastMessage.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
