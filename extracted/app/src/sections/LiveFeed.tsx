import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { AttendanceHook } from '@/hooks/useAttendance';

interface LiveFeedProps {
  attendance: AttendanceHook;
}

export function LiveFeed({ attendance }: LiveFeedProps) {
  const [liveRecords, setLiveRecords] = useState(attendance.getAllRecords(new Date().toISOString().split('T')[0]));

  // Poll for new records every 3 seconds (in a real app, use WebSockets/Supabase Realtime)
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveRecords(attendance.getAllRecords(new Date().toISOString().split('T')[0]));
    }, 3000);
    return () => clearInterval(interval);
  }, [attendance]);

  const sortedRecords = [...liveRecords].sort((a, b) => {
    const timeA = a.clockIn?.time || "00:00";
    const timeB = b.clockIn?.time || "00:00";
    return timeB.localeCompare(timeA); // Newest first
  });

  return (
    <div className="space-y-4 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#e0e0f0] flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            Live Entrance Feed
          </h2>
          <p className="text-sm text-[#888]">Monitoring physical check-ins today</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {sortedRecords.length === 0 ? (
          <div className="col-span-full py-20 text-center text-[#888]">
            No activity today yet.
          </div>
        ) : (
          sortedRecords.map(record => (
            <Card key={record.id} className="bg-[#1e1e35] border-[#2a2a4a] overflow-hidden">
              <div className="relative aspect-[4/3] bg-black">
                {record.clockIn?.photo ? (
                  <img 
                    src={record.clockIn.photo} 
                    alt={record.userName} 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-[#666]">
                    <ShieldAlert className="w-12 h-12 mb-2" />
                    <p>No Photo Available</p>
                  </div>
                )}
                <div className="absolute top-2 right-2 flex flex-col gap-2 items-end">
                  {record.isLate ? (
                    <Badge className="bg-amber-500/90 text-white border-none shadow-lg">Late</Badge>
                  ) : (
                    <Badge className="bg-emerald-500/90 text-white border-none shadow-lg">On Time</Badge>
                  )}
                  {record.mood && (
                    <Badge className="bg-blue-500/90 text-white border-none shadow-lg capitalize">Mood: {record.mood}</Badge>
                  )}
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4 pt-10">
                  <p className="text-white font-bold text-lg">{record.userName}</p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-[#bbb] text-sm flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {record.clockIn?.time || '--:--'}
                    </p>
                    <p className="text-emerald-400 text-xs font-mono uppercase bg-black/50 px-2 py-1 rounded">
                      {record.clockIn?.method} VERIFIED
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
