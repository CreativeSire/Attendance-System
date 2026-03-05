import { useState, useCallback, useEffect } from 'react';
import type { AttendanceRecord, LeaveRequest, ExpenseRequest, BroadcastMessage } from '@/types';
import { format } from 'date-fns';

const API_BASE_URL = 'http://localhost:3001/api';

// Nigerian payroll constants
const WORKING_DAYS_PER_MONTH = 22;
const WORK_START_HOUR = 8;
const LATE_THRESHOLD_MINUTES = 10; // 8:10 AM
const LATE_PENALTY_RATE = 0.1; // 10% of daily rate per late day

const getToday = () => new Date().toISOString().split('T')[0];

export function useAttendance() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRequest[]>([]);
  const [broadcasts, setBroadcasts] = useState<BroadcastMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [recRes, leaveRes, expRes, broadRes] = await Promise.all([
        fetch(`${API_BASE_URL}/attendance/all`),
        fetch(`${API_BASE_URL}/leaves/all`),
        fetch(`${API_BASE_URL}/expenses/all`),
        fetch(`${API_BASE_URL}/broadcasts/all`)
      ]);
      
      const [recData, leaveData, expData, broadData] = await Promise.all([
        recRes.json(),
        leaveRes.json(),
        expRes.json(),
        broadRes.json()
      ]);

      setRecords(recData);
      setLeaves(leaveData);
      setExpenses(expData);
      setBroadcasts(broadData);
    } catch (err) {
      console.error('Failed to fetch attendance data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const clockIn = useCallback(async (userId: string, userName: string, location: { lat: number; lng: number }, method: 'gps' | 'qr' | 'manual', photo?: string, mood?: string, lateReason?: string) => {
    const now = new Date();
    const [currentHour, currentMinute] = format(now, 'HH:mm').split(':').map(Number);
    const workMinutes = WORK_START_HOUR * 60;
    const currentMinutes = currentHour * 60 + currentMinute;

    const isLate = currentMinutes > workMinutes + LATE_THRESHOLD_MINUTES;
    const lateMinutes = isLate ? currentMinutes - workMinutes : 0;

    try {
      const res = await fetch(`${API_BASE_URL}/attendance/clock-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, userName, location, method, photo, mood, lateReason, isLate, lateMinutes })
      });
      
      if (res.ok) {
        const newRecord = await res.json();
        setRecords(prev => [newRecord, ...prev]);
        return { success: true, isLate, lateMinutes };
      }
      return { success: false, error: 'Clock-in failed' };
    } catch (err) {
      return { success: false, error: 'Network error' };
    }
  }, []);

  const clockOut = useCallback(async (userId: string, location: { lat: number; lng: number }, method: 'gps' | 'qr' | 'manual', photo?: string) => {
    try {
      // Fetch today's record to calculate hours
      const today = getToday();
      const record = records.find(r => r.userId === userId && r.date === today);
      
      let totalHours = 0;
      if (record && record.clockInTime) {
        const [inHour, inMinute] = record.clockInTime.split(':').map(Number);
        const now = new Date();
        const outHour = now.getHours();
        const outMinute = now.getMinutes();
        totalHours = (outHour - inHour) + (outMinute - inMinute) / 60;
      }

      const res = await fetch(`${API_BASE_URL}/attendance/clock-out`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, location, method, photo, totalHours: Math.round(totalHours * 100) / 100 })
      });
      
      if (res.ok) {
        await fetchData(); // Refresh all
        return { success: true, totalHours: Math.round(totalHours * 100) / 100 };
      }
      return { success: false, error: 'Clock-out failed' };
    } catch (err) {
      return { success: false, error: 'Network error' };
    }
  }, [records, fetchData]);

  const addLeave = useCallback(async (leave: Omit<LeaveRequest, 'id' | 'status'>) => {
    try {
      const res = await fetch(`${API_BASE_URL}/leaves`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leave)
      });
      if (res.ok) {
        const newLeave = await res.json();
        setLeaves(prev => [newLeave, ...prev]);
        return { success: true };
      }
      return { success: false };
    } catch (err) {
      return { success: false };
    }
  }, []);

  const addExpense = useCallback(async (expense: Omit<ExpenseRequest, 'id' | 'status'>) => {
    try {
      const res = await fetch(`${API_BASE_URL}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expense)
      });
      if (res.ok) {
        const newExpense = await res.json();
        setExpenses(prev => [newExpense, ...prev]);
        return { success: true };
      }
      return { success: false };
    } catch (err) {
      return { success: false };
    }
  }, []);

  const addBroadcast = useCallback(async (message: string, senderName: string) => {
    try {
      const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
      const res = await fetch(`${API_BASE_URL}/broadcasts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, senderName, expiresAt })
      });
      if (res.ok) {
        const newBroadcast = await res.json();
        setBroadcasts(prev => [newBroadcast, ...prev]);
      }
    } catch (err) {}
  }, []);

  const deleteBroadcast = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/broadcasts/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setBroadcasts(prev => prev.filter(b => b.id !== id));
      }
    } catch (err) {}
  }, []);

  const getTodayRecord = useCallback((userId: string): AttendanceRecord | undefined => {
    const today = getToday();
    return records.find(r => r.userId === userId && r.date === today);
  }, [records]);

  const calculatePayroll = useCallback((userId: string, monthlySalary: number, period: string) => {
    const userRecords = records.filter(r => r.userId === userId && r.date.startsWith(period));
    const userExpenses = expenses.filter(e => e.userId === userId && e.status === 'approved' && e.date.startsWith(period));
    
    const presentDays = new Set(userRecords.filter(r => r.status === 'present' || r.status === 'late').map(r => r.date)).size;
    const totalHours = userRecords.reduce((sum, r) => sum + r.totalHours, 0);
    const lateCount = userRecords.filter(r => r.isLate).length;
    
    const dailyRate = monthlySalary / WORKING_DAYS_PER_MONTH;
    const grossPay = presentDays * dailyRate;
    
    const pensionContribution = grossPay * 0.08;
    const expenseReimbursement = userExpenses.reduce((sum, e) => sum + e.amount, 0);
    
    let taxableIncome = grossPay - pensionContribution;
    let payeTax = 0;
    if (taxableIncome > 250000) { payeTax += (taxableIncome - 250000) * 0.24; taxableIncome = 250000; }
    if (taxableIncome > 133333) { payeTax += (taxableIncome - 133333) * 0.19; taxableIncome = 133333; }
    if (taxableIncome > 41666) { payeTax += (taxableIncome - 41666) * 0.11; taxableIncome = 41666; }
    payeTax += taxableIncome * 0.07;

    const latePenalty = lateCount * (dailyRate * LATE_PENALTY_RATE);
    const netPay = Math.max(0, grossPay - pensionContribution - payeTax - latePenalty + expenseReimbursement);
    
    return {
      userId,
      presentDays,
      totalHours: Math.round(totalHours * 10) / 10,
      lateCount,
      dailyRate: Math.round(dailyRate),
      grossPay: Math.round(grossPay),
      pensionContribution: Math.round(pensionContribution),
      payeTax: Math.round(payeTax),
      latePenalty: Math.round(latePenalty),
      expenseReimbursement: Math.round(expenseReimbursement),
      netPay: Math.round(netPay),
      monthlySalary
    };
  }, [records, expenses]);

  const fmtNaira = (n: number) => `₦${n.toLocaleString()}`;

  return {
    records,
    leaves,
    expenses,
    broadcasts,
    clockIn,
    clockOut,
    addLeave,
    addExpense,
    addBroadcast,
    deleteBroadcast,
    getTodayRecord,
    calculatePayroll,
    fmtNaira,
    loading
  };
}
