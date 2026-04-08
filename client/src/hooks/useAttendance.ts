import { useState, useEffect, useCallback } from 'react';
import { attendanceApi } from '@/api/attendance';
import type { AttendanceRecord } from '@/types';
import { useSocket } from './useSocket';

export function useAttendance() {
  const { socket } = useSocket();
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTodayStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await attendanceApi.getTodayStatus();
      setTodayRecord(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch attendance status');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTodayStatus();
  }, [fetchTodayStatus]);

  useEffect(() => {
    if (!socket) return;

    const handleClockIn = (data: AttendanceRecord) => {
      setTodayRecord(data);
    };

    const handleClockOut = (data: AttendanceRecord) => {
      setTodayRecord(data);
    };

    socket.on('attendance:clockin', handleClockIn);
    socket.on('attendance:clockout', handleClockOut);

    return () => {
      socket.off('attendance:clockin', handleClockIn);
      socket.off('attendance:clockout', handleClockOut);
    };
  }, [socket]);

  const isClockedIn = !!todayRecord?.clockIn && !todayRecord?.clockOut;
  const isClockedOut = !!todayRecord?.clockIn && !!todayRecord?.clockOut;

  return {
    todayRecord,
    isLoading,
    error,
    isClockedIn,
    isClockedOut,
    refresh: fetchTodayStatus,
  };
}
