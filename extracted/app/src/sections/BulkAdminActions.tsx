import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Users, 
  LogIn, 
  LogOut, 
  UserX,
  Search
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface BulkAdminActionsProps {
  attendance: any;
}

export function BulkAdminActions({ attendance }: BulkAdminActionsProps) {
  const { employees } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [processing, setProcessing] = useState<Record<string, boolean>>({});

  const todayRecords = attendance.getAllRecords(new Date().toISOString().split('T')[0]);

  const getEmployeeStatus = (empId: string) => {
    const record = todayRecords.find((r: any) => r.userId === empId);
    if (!record) return 'no-record';
    if (record.status === 'absent') return 'absent';
    if (record.clockOut) return 'completed';
    if (record.clockIn) return 'active';
    return 'no-record';
  };

  const filteredEmployees = employees.filter(emp => 
    emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.department?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleClockIn = async (emp: any) => {
    setProcessing(prev => ({ ...prev, [emp.id]: true }));
    const result = attendance.clockIn(emp.id, emp.name, { lat: 6.5244, lng: 3.3792 }, 'admin');
    if (result.success) {
      if (result.isLate) {
        toast(`${emp.name} is ${result.lateMinutes} min late`, 'warning');
      } else {
        toast(`${emp.name} checked in`, 'success');
      }
    } else {
      toast(`${emp.name} already checked in`, 'error');
    }
    setProcessing(prev => ({ ...prev, [emp.id]: false }));
  };

  const handleClockOut = async (emp: any) => {
    setProcessing(prev => ({ ...prev, [emp.id]: true }));
    const result = attendance.clockOut(emp.id, { lat: 6.5244, lng: 3.3792 }, 'admin');
    if (result.success) {
      toast(`${emp.name} checked out (${result.totalHours}h)`, 'success');
    } else {
      toast(`${emp.name} hasn't checked in`, 'error');
    }
    setProcessing(prev => ({ ...prev, [emp.id]: false }));
  };

  const handleMarkAbsent = async (emp: any) => {
    setProcessing(prev => ({ ...prev, [emp.id]: true }));
    const result = attendance.markAbsent(emp.id, emp.name);
    if (result.success) {
      toast(`${emp.name} marked absent`, 'info');
    } else {
      toast(`${emp.name} already has a record`, 'error');
    }
    setProcessing(prev => ({ ...prev, [emp.id]: false }));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-emerald-500/20 text-emerald-400">Active</Badge>;
      case 'completed':
        return <Badge className="bg-[#6C63FF]/20 text-[#6C63FF]">Done</Badge>;
      case 'absent':
        return <Badge className="bg-red-500/20 text-red-400">Absent</Badge>;
      default:
        return <Badge variant="outline" className="border-[#2a2a4a] text-[#666]">--</Badge>;
    }
  };

  return (
    <div className="space-y-4 pb-20">
      <div>
        <h2 className="text-xl font-bold text-[#e0e0f0]">Bulk Actions</h2>
        <p className="text-sm text-[#888]">Manage all staff attendance</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666]" />
        <Input 
          placeholder="Search employees..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-[#0f0f1a] border-[#2a2a4a] text-[#e0e0f0]"
        />
      </div>

      <div className="space-y-3">
        {filteredEmployees.map((emp) => {
          const status = getEmployeeStatus(emp.id);
          const record = todayRecords.find((r: any) => r.userId === emp.id);
          
          return (
            <Card 
              key={emp.id} 
              className={cn(
                "bg-[#1e1e35] border-[#2a2a4a] overflow-hidden",
                status === 'active' && "border-l-4 border-l-emerald-500",
                status === 'completed' && "border-l-4 border-l-[#6C63FF]",
                status === 'absent' && "border-l-4 border-l-red-500"
              )}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#2a2a4a] flex items-center justify-center">
                      <span className="font-bold text-[#6C63FF]">{emp.name.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="font-medium text-[#e0e0f0]">{emp.name}</p>
                      <p className="text-xs text-[#888]">{emp.department}</p>
                    </div>
                  </div>
                  {getStatusBadge(status)}
                </div>

                {record && (
                  <div className="flex items-center gap-4 text-sm text-[#666] mb-3">
                    <span>In: {record.clockIn?.time || '--:--'}</span>
                    <span>Out: {record.clockOut?.time || '--:--'}</span>
                    {record.totalHours > 0 && <span className="text-emerald-400">{record.totalHours}h</span>}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className={cn(
                      "flex-1 h-10 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/20",
                      (status === 'active' || status === 'completed' || status === 'absent') && "opacity-50"
                    )}
                    disabled={status === 'active' || status === 'completed' || status === 'absent' || processing[emp.id]}
                    onClick={() => handleClockIn(emp)}
                  >
                    <LogIn className="w-4 h-4 mr-1" />
                    In
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    className={cn(
                      "flex-1 h-10 border-[#6C63FF]/50 text-[#6C63FF] hover:bg-[#6C63FF]/20",
                      status !== 'active' && "opacity-50"
                    )}
                    disabled={status !== 'active' || processing[emp.id]}
                    onClick={() => handleClockOut(emp)}
                  >
                    <LogOut className="w-4 h-4 mr-1" />
                    Out
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    className={cn(
                      "flex-1 h-10 border-red-500/50 text-red-400 hover:bg-red-500/20",
                      status !== 'no-record' && "opacity-50"
                    )}
                    disabled={status !== 'no-record' || processing[emp.id]}
                    onClick={() => handleMarkAbsent(emp)}
                  >
                    <UserX className="w-4 h-4 mr-1" />
                    Absent
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filteredEmployees.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-12 h-12 mx-auto mb-3 text-[#666]" />
            <p className="text-[#888]">No employees found</p>
          </div>
        )}
      </div>
    </div>
  );
}
