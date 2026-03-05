import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  Briefcase, 
  Plus, 
  Calendar,
  CheckCircle2,
  XCircle,
  User,
  AlertTriangle
} from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import type { LeaveRequest } from '@/types';

interface LeaveManagementProps {
  attendance: any;
}

export function LeaveManagement({ attendance }: LeaveManagementProps) {
  const { user, hasRole } = useAuth();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [leaveType, setLeaveType] = useState<string>('vacation');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const userLeaves = user ? attendance.getUserLeaves(user.id) : [];
  const pendingLeaves = attendance.getPendingLeaves();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);
    
    const result = attendance.requestLeave({
      userId: user.id,
      userName: user.name,
      type: leaveType as any,
      startDate,
      endDate,
      reason
    });

    if (result.success) {
      setIsDialogOpen(false);
      setLeaveType('vacation');
      setStartDate(format(new Date(), 'yyyy-MM-dd'));
      setEndDate(format(new Date(), 'yyyy-MM-dd'));
      setReason('');
      toast('Leave request submitted!', 'success');
    }
    
    setIsSubmitting(false);
  };

  const handleApprove = (leaveId: string) => {
    if (user) {
      attendance.approveLeave(leaveId, user.name);
      toast('Leave approved!', 'success');
    }
  };

  const handleReject = (leaveId: string) => {
    attendance.rejectLeave(leaveId);
    toast('Leave rejected', 'info');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-emerald-500/20 text-emerald-400">Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500/20 text-red-400">Rejected</Badge>;
      case 'pending':
        return <Badge className="bg-amber-500/20 text-amber-400">Pending</Badge>;
      default:
        return <Badge variant="outline" className="border-[#2a2a4a] text-[#888]">{status}</Badge>;
    }
  };

  const getLeaveTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      sick: 'bg-red-500/20 text-red-400',
      vacation: 'bg-blue-500/20 text-blue-400',
      personal: 'bg-purple-500/20 text-purple-400',
      other: 'bg-slate-500/20 text-slate-400'
    };
    return (
      <Badge variant="outline" className={cn("capitalize border-[#2a2a4a]", colors[type] || colors.other)}>
        {type}
      </Badge>
    );
  };

  const calculateDuration = (start: string, end: string) => {
    const days = differenceInDays(parseISO(end), parseISO(start)) + 1;
    return `${days} day${days > 1 ? 's' : ''}`;
  };

  const stats = [
    { label: 'Total', value: userLeaves.length, color: 'text-[#e0e0f0]' },
    { label: 'Pending', value: userLeaves.filter((l: LeaveRequest) => l.status === 'pending').length, color: 'text-amber-400' },
    { label: 'Approved', value: userLeaves.filter((l: LeaveRequest) => l.status === 'approved').length, color: 'text-emerald-400' },
    { label: 'To Review', value: hasRole(['admin', 'manager']) ? pendingLeaves.length : 0, color: 'text-blue-400' },
  ];

  return (
    <div className="space-y-4 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#e0e0f0]">Leave</h2>
          <p className="text-sm text-[#888]">Manage leave requests</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#6C63FF] hover:bg-[#5a52d5]">
              <Plus className="w-4 h-4 mr-1" />
              Request
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#1e1e35] border-[#2a2a4a] max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-[#e0e0f0]">Request Leave</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label className="text-[#e0e0f0] text-sm">Type</Label>
                <Select value={leaveType} onValueChange={setLeaveType}>
                  <SelectTrigger className="bg-[#0f0f1a] border-[#2a2a4a] text-[#e0e0f0]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1e1e35] border-[#2a2a4a]">
                    <SelectItem value="sick">Sick Leave</SelectItem>
                    <SelectItem value="vacation">Vacation</SelectItem>
                    <SelectItem value="personal">Personal</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-[#e0e0f0] text-sm">Start</Label>
                  <Input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    className="bg-[#0f0f1a] border-[#2a2a4a] text-[#e0e0f0]"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[#e0e0f0] text-sm">End</Label>
                  <Input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                    className="bg-[#0f0f1a] border-[#2a2a4a] text-[#e0e0f0]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[#e0e0f0] text-sm">Reason</Label>
                <Textarea 
                  placeholder="Why do you need leave?"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  rows={3}
                  className="bg-[#0f0f1a] border-[#2a2a4a] text-[#e0e0f0]"
                />
              </div>

              <Button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full bg-[#6C63FF] hover:bg-[#5a52d5]"
              >
                {isSubmitting ? 'Submitting...' : 'Submit'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {stats.map((stat, i) => (
          <Card key={i} className="bg-[#1e1e35] border-[#2a2a4a]">
            <CardContent className="p-3 text-center">
              <p className={cn("text-lg font-bold", stat.color)}>{stat.value}</p>
              <p className="text-[10px] text-[#888]">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {hasRole(['admin', 'manager']) && pendingLeaves.length > 0 && (
        <Card className="bg-amber-500/10 border-amber-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-amber-400 text-sm">
              <AlertTriangle className="w-4 h-4" />
              Pending ({pendingLeaves.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingLeaves.map((leave: LeaveRequest) => (
              <div key={leave.id} className="p-3 bg-[#1e1e35] rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#2a2a4a] flex items-center justify-center">
                      <User className="w-4 h-4 text-[#888]" />
                    </div>
                    <div>
                      <p className="font-medium text-sm text-[#e0e0f0]">{leave.userName}</p>
                      <p className="text-xs text-[#888]">{getLeaveTypeBadge(leave.type)}</p>
                    </div>
                  </div>
                  <span className="text-xs text-[#888]">{calculateDuration(leave.startDate, leave.endDate)}</span>
                </div>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleReject(leave.id)}
                    className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/20 h-9"
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    Reject
                  </Button>
                  <Button 
                    size="sm"
                    onClick={() => handleApprove(leave.id)}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 h-9"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Approve
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div>
        <h3 className="font-medium text-[#e0e0f0] mb-3">My Requests</h3>
        <div className="space-y-3">
          {userLeaves.length > 0 ? (
            userLeaves.map((leave: LeaveRequest) => (
              <Card key={leave.id} className="bg-[#1e1e35] border-[#2a2a4a]">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      {getLeaveTypeBadge(leave.type)}
                      <p className="text-sm text-[#888] mt-1">
                        {calculateDuration(leave.startDate, leave.endDate)}
                      </p>
                    </div>
                    {getStatusBadge(leave.status)}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[#888]">
                    <Calendar className="w-4 h-4" />
                    <span>
                      {format(parseISO(leave.startDate), 'MMM d')} - {format(parseISO(leave.endDate), 'MMM d, yyyy')}
                    </span>
                  </div>
                  {leave.reason && (
                    <p className="text-sm text-[#666] mt-2 line-clamp-2">{leave.reason}</p>
                  )}
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-12">
              <Briefcase className="w-12 h-12 mx-auto mb-3 text-[#666]" />
              <p className="text-[#888]">No leave requests yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
