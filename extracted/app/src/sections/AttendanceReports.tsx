import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Calendar, 
  FileSpreadsheet,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Edit2,
  Check,
  X,
  User,
  Image as ImageIcon,
  Smile,
  Frown,
  Meh,
  MessageCircle,
  ShieldAlert
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';
import type { AttendanceRecord } from '@/types';

interface AttendanceReportsProps {
  attendance: any;
}

export function AttendanceReports({ attendance }: AttendanceReportsProps) {
  const { user, hasRole } = useAuth();
  const { toast } = useToast();
  const [showCorrection, setShowCorrection] = useState<string | null>(null);
  const [newTime, setNewTime] = useState('');
  const [reason, setReason] = useState('');
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);

  const isAdmin = hasRole(['admin', 'manager']);
  
  const records: AttendanceRecord[] = isAdmin 
    ? attendance.getAllRecords() 
    : attendance.getUserRecords(user?.id || '');

  const handleRequestCorrection = (record: AttendanceRecord) => {
    if (!newTime || !reason) return;
    attendance.requestCorrection(user!.id, record.date, newTime, reason);
    toast('Correction request sent!', 'success');
    setShowCorrection(null);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'present': return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Present</Badge>;
      case 'late': return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Late</Badge>;
      case 'absent': return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Absent</Badge>;
      case 'pending_correction': return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Correction Pending</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getMoodIcon = (mood?: string) => {
    switch (mood) {
      case 'happy': return <Smile className="w-4 h-4 text-emerald-400" />;
      case 'sad': return <Frown className="w-4 h-4 text-blue-400" />;
      case 'angry': return <ShieldAlert className="w-4 h-4 text-red-400" />;
      case 'surprised': return <Meh className="w-4 h-4 text-amber-400" />;
      default: return <Meh className="w-4 h-4 text-[#888]" />;
    }
  };

  return (
    <div className="space-y-4 pb-20">
      <h2 className="text-xl font-bold text-[#e0e0f0]">Attendance Log</h2>

      <div className="space-y-3">
        {records.map((record) => (
          <Card key={record.id} className="bg-[#1e1e35] border-[#2a2a4a]">
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-4">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#2a2a4a] flex items-center justify-center relative">
                    <User className="w-5 h-5 text-[#6C63FF]" />
                    {record.mood && (
                      <div className="absolute -bottom-1 -right-1 bg-[#1e1e35] rounded-full p-0.5 border border-[#2a2a4a]">
                        {getMoodIcon(record.mood)}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-[#e0e0f0]">{record.userName}</p>
                    <p className="text-xs text-[#888]">{format(parseISO(record.date), 'MMM d, yyyy')}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {getStatusBadge(record.status)}
                  {record.lateReason && (
                    <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400 py-0 h-5">
                      <MessageCircle className="w-3 h-3 mr-1" /> {record.lateReason}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 py-3 border-y border-[#2a2a4a] text-center">
                <div><p className="text-xs text-[#666]">In</p><p className="text-sm font-medium text-[#e0e0f0]">{record.clockIn?.time || '--:--'}</p></div>
                <div><p className="text-xs text-[#666]">Out</p><p className="text-sm font-medium text-[#e0e0f0]">{record.clockOut?.time || '--:--'}</p></div>
                <div><p className="text-xs text-[#666]">Total</p><p className="text-sm font-medium text-[#e0e0f0]">{record.totalHours}h</p></div>
              </div>

              <div className="flex gap-2 mt-4">
                {record.clockIn?.photo && (
                  <Button variant="ghost" size="sm" onClick={() => setViewPhoto(record.clockIn!.photo!)} className="text-[#6C63FF]"><ImageIcon className="w-4 h-4 mr-1" /> View ID</Button>
                )}
                {!isAdmin && record.status !== 'pending_correction' && (
                  <Button variant="ghost" size="sm" onClick={() => setShowCorrection(record.id)} className="ml-auto"><Edit2 className="w-3 h-3 mr-1" /> Fix</Button>
                )}
                {isAdmin && record.status === 'pending_correction' && (
                  <div className="flex gap-2 ml-auto">
                    <Button size="sm" className="bg-emerald-500" onClick={() => attendance.approveCorrection(record.id, user!.name)}><Check className="w-4 h-4" /> Approve</Button>
                  </div>
                )}
              </div>

              {showCorrection === record.id && (
                <div className="mt-4 p-4 bg-[#0f0f1a] rounded-xl space-y-3">
                  <Label>Correct In Time (HH:mm)</Label>
                  <Input value={newTime} onChange={e => setNewTime(e.target.value)} placeholder="08:00" />
                  <Label>Reason</Label>
                  <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Phone was dead" />
                  <Button onClick={() => handleRequestCorrection(record)} className="w-full bg-[#6C63FF]">Send Request</Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {viewPhoto && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-6" onClick={() => setViewPhoto(null)}>
          <img src={viewPhoto} className="max-w-full max-h-full rounded-2xl border-4 border-[#6C63FF]" alt="Selfie Verification" />
          <p className="absolute bottom-10 text-white font-bold">Face Capture Verification</p>
        </div>
      )}
    </div>
  );
}
