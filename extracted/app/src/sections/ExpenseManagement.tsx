import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Receipt, Check, X, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AttendanceHook } from '@/hooks/useAttendance';

interface ExpenseManagementProps {
  attendance: AttendanceHook;
}

export function ExpenseManagement({ attendance }: ExpenseManagementProps) {
  const { user, hasRole } = useAuth();
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [type, setType] = useState<'transport' | 'data' | 'other'>('transport');

  const isAdmin = hasRole(['admin', 'manager']);

  const handleAddExpense = () => {
    if (!user || !amount || !reason) return;
    const result = attendance.addExpense({
      userId: user.id,
      userName: user.name,
      date: new Date().toISOString().split('T')[0],
      amount: parseFloat(amount),
      reason,
      type
    });
    if (result.success) {
      toast('Expense request submitted!', 'success');
      setShowAdd(false);
      setAmount('');
      setReason('');
    }
  };

  const myExpenses = attendance.expenses.filter(e => e.userId === user?.id);
  const pendingExpenses = attendance.expenses.filter(e => e.status === 'pending');

  return (
    <div className="space-y-4 pb-20">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[#e0e0f0]">Expenses</h2>
        <Button onClick={() => setShowAdd(!showAdd)} className="bg-[#6C63FF]"><Plus className="w-4 h-4 mr-1" /> Request</Button>
      </div>

      {showAdd && (
        <Card className="bg-[#1e1e35] border-[#2a2a4a]">
          <CardContent className="p-4 space-y-4">
            <div>
              <Label className="text-[#888]">Amount (Naira)</Label>
              <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="bg-[#0f0f1a] border-[#2a2a4a] text-[#e0e0f0]" />
            </div>
            <div>
              <Label className="text-[#888]">Type</Label>
              <Select value={type} onValueChange={(v: any) => setType(v)}>
                <SelectTrigger className="bg-[#0f0f1a] border-[#2a2a4a] text-[#e0e0f0]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1e1e35] border-[#2a2a4a]">
                  <SelectItem value="transport">Transport</SelectItem>
                  <SelectItem value="data">Data Allowance</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[#888]">Reason</Label>
              <Input value={reason} onChange={e => setReason(e.target.value)} className="bg-[#0f0f1a] border-[#2a2a4a] text-[#e0e0f0]" />
            </div>
            <Button onClick={handleAddExpense} className="w-full bg-[#6C63FF]">Submit Request</Button>
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <div className="space-y-3">
          <h3 className="font-medium text-amber-400 flex items-center gap-2"><Clock className="w-4 h-4" /> Pending Approvals</h3>
          {pendingExpenses.map(e => (
            <Card key={e.id} className="bg-[#1e1e35] border-amber-500/20">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-bold text-[#e0e0f0]">{e.userName}</p>
                  <p className="text-xs text-[#888]">{e.reason} (N{e.amount.toLocaleString()})</p>
                </div>
                <div className="flex gap-2">
                  <Button size="icon" variant="ghost" className="text-emerald-400 bg-emerald-400/10" onClick={() => attendance.approveExpense(e.id, user!.name)}><Check className="w-4 h-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="space-y-3">
        <h3 className="font-medium text-[#e0e0f0]">My Requests</h3>
        {myExpenses.map(e => (
          <Card key={e.id} className="bg-[#1e1e35] border-[#2a2a4a]">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-[#e0e0f0]">{e.type.toUpperCase()}</p>
                <p className="text-xs text-[#888]">{e.reason}</p>
                <p className="text-xs font-bold text-emerald-400">N{e.amount.toLocaleString()}</p>
              </div>
              <Badge className={cn(e.status === 'approved' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20")}>
                {e.status.toUpperCase()}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
