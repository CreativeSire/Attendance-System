import { useEffect, useState, useCallback, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import { Plus, CheckCircle, XCircle, Receipt, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { expensesApi } from '@/api/expenses';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import type { ExpenseRequest } from '@/types';
import { getStatusBg } from '@/lib/utils';

const expenseSchema = z.object({
  title: z.string().min(2, 'Title required'),
  amount: z.coerce.number().positive('Must be positive'),
  category: z.string().min(1, 'Category required'),
  date: z.string().min(1, 'Date required'),
  description: z.string().optional(),
});

type ExpenseForm = z.infer<typeof expenseSchema>;

function Spinner() {
  return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls = getStatusBg(status);
  return <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${cls}`}>{status}</span>;
}

function CategoryBadge({ category }: { category: string }) {
  const colors: Record<string, string> = {
    TRAVEL: 'bg-blue-400/20 text-blue-400',
    MEALS: 'bg-warning/20 text-warning',
    ACCOMMODATION: 'bg-purple-400/20 text-purple-400',
    EQUIPMENT: 'bg-accent/20 text-accent',
    TRAINING: 'bg-success/20 text-success',
    OTHER: 'bg-gray-400/20 text-gray-400',
  };
  return <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${colors[category] ?? 'bg-gray-400/20 text-gray-400'}`}>{category}</span>;
}

function NewExpenseDialog({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ExpenseForm>({
    resolver: zodResolver(expenseSchema),
    defaultValues: { date: format(new Date(), 'yyyy-MM-dd') },
  });
  const [receiptBase64, setReceiptBase64] = useState<string | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setReceiptBase64(result.split(',')[1]);
      setReceiptPreview(result);
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = async (data: ExpenseForm) => {
    try {
      await expensesApi.create({ ...data, receiptBase64: receiptBase64 ?? undefined });
      toast.success('Expense submitted!');
      reset();
      setReceiptBase64(null);
      setReceiptPreview(null);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit expense');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-surface border-border text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">New Expense</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label className="text-gray-300">Title <span className="text-danger">*</span></Label>
            <Input {...register('title')} placeholder="Expense title..." className="bg-surface-2 border-border text-white placeholder:text-gray-500" />
            {errors.title && <p className="text-danger text-xs">{errors.title.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-gray-300">Amount (&#8358;) <span className="text-danger">*</span></Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">&#8358;</span>
                <Input type="number" {...register('amount')} placeholder="0" className="pl-7 bg-surface-2 border-border text-white placeholder:text-gray-500" />
              </div>
              {errors.amount && <p className="text-danger text-xs">{errors.amount.message}</p>}
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Date <span className="text-danger">*</span></Label>
              <Input type="date" {...register('date')} className="bg-surface-2 border-border text-white" />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">Category <span className="text-danger">*</span></Label>
            <select {...register('category')} className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent">
              <option value="">Select category...</option>
              {['TRAVEL', 'MEALS', 'ACCOMMODATION', 'EQUIPMENT', 'TRAINING', 'OTHER'].map((c) => (
                <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>
              ))}
            </select>
            {errors.category && <p className="text-danger text-xs">{errors.category.message}</p>}
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">Description</Label>
            <textarea {...register('description')} placeholder="Additional details..." rows={2}
              className="w-full bg-surface-2 border border-border rounded-lg p-3 text-white placeholder:text-gray-500 text-sm resize-none focus:outline-none focus:border-accent" />
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">Receipt</Label>
            <input ref={fileRef} type="file" accept="image/*,.pdf" onChange={handleFile} className="hidden" />
            {receiptPreview ? (
              <div className="relative">
                <img src={receiptPreview} alt="Receipt" className="w-full h-32 object-cover rounded-lg" />
                <button type="button" onClick={() => { setReceiptBase64(null); setReceiptPreview(null); }}
                  className="absolute top-2 right-2 bg-danger text-white text-xs px-2 py-1 rounded">Remove</button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 border border-dashed border-border rounded-lg py-4 text-gray-500 hover:text-gray-300 hover:border-accent transition-colors text-sm">
                <Upload size={16} /> Upload receipt
              </button>
            )}
          </div>

          <Button type="submit" className="w-full gradient-accent text-white" isLoading={isSubmitting}>
            Submit Expense
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RejectDialog({ open, onClose, onConfirm }: { open: boolean; onClose: () => void; onConfirm: (note: string) => Promise<void> }) {
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const handle = async () => { setLoading(true); try { await onConfirm(note); onClose(); setNote(''); } finally { setLoading(false); } };
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-surface border-border text-white max-w-sm">
        <DialogHeader><DialogTitle>Reject Expense</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason for rejection..." rows={3}
            className="w-full bg-surface-2 border border-border rounded-lg p-3 text-white placeholder:text-gray-500 text-sm resize-none focus:outline-none focus:border-accent" />
          <Button onClick={handle} isLoading={loading} variant="destructive" className="w-full">Confirm Reject</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Expenses() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'manager';
  const [activeTab, setActiveTab] = useState<'my' | 'pending' | 'all'>('my');
  const [myExpenses, setMyExpenses] = useState<ExpenseRequest[]>([]);
  const [teamExpenses, setTeamExpenses] = useState<ExpenseRequest[]>([]);
  const [summary, setSummary] = useState<{ category: string; total: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [newExpenseOpen, setNewExpenseOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [myRes] = await Promise.all([expensesApi.getMyExpenses({ limit: 100 })]);
      setMyExpenses(((myRes as { data: { data: ExpenseRequest[] } }).data?.data) ?? []);

      if (isAdmin) {
        const [teamRes, sumRes] = await Promise.all([
          expensesApi.getTeamExpenses({ limit: 200 }),
          expensesApi.getMonthlySummary(),
        ]);
        setTeamExpenses(((teamRes as { data: { data: ExpenseRequest[] } }).data?.data) ?? []);
        setSummary(((sumRes as { data: { category: string; total: number }[] }).data) ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleApprove = async (id: string) => {
    try { await expensesApi.approve(id); toast.success('Expense approved'); loadData(); }
    catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed'); }
  };

  const handleReject = async (note: string) => {
    if (!rejectTarget) return;
    await expensesApi.reject(rejectTarget, note);
    toast.success('Expense rejected');
    loadData();
  };

  const thisMonth = new Date();
  const monthStr = format(thisMonth, 'yyyy-MM');
  const myMonthExpenses = myExpenses.filter((e) => e.date.startsWith(monthStr));
  const totalSubmitted = myMonthExpenses.reduce((s, e) => s + e.amount, 0);
  const totalApproved = myMonthExpenses.filter((e) => e.status === 'APPROVED').reduce((s, e) => s + e.amount, 0);
  const totalPending = myMonthExpenses.filter((e) => e.status === 'PENDING').reduce((s, e) => s + e.amount, 0);
  const pendingTeamExpenses = teamExpenses.filter((e) => e.status === 'PENDING');

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Expenses</h1>
          <p className="text-gray-400 text-sm mt-1">Submit and track expense claims</p>
        </div>
        <Button onClick={() => setNewExpenseOpen(true)} className="gradient-accent text-white">
          <Plus size={16} /> New Expense
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Submitted (Month)', value: `\u20A6${totalSubmitted.toLocaleString()}`, color: 'text-white' },
          { label: 'Approved', value: `\u20A6${totalApproved.toLocaleString()}`, color: 'text-success' },
          { label: 'Pending', value: `\u20A6${totalPending.toLocaleString()}`, color: 'text-warning' },
          { label: 'Reimbursed', value: `\u20A6${totalApproved.toLocaleString()}`, color: 'text-accent' },
        ].map((s) => (
          <div key={s.label} className="bg-surface border border-border rounded-xl p-4">
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-gray-500 text-xs mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      {isAdmin && (
        <div className="flex bg-surface-2 rounded-xl p-1 gap-1 w-fit">
          {([
            { key: 'my', label: 'My Expenses' },
            { key: 'pending', label: `Pending (${pendingTeamExpenses.length})` },
            { key: 'all', label: 'All' },
          ] as const).map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
                ${activeTab === tab.key ? 'gradient-accent text-white shadow' : 'text-gray-400 hover:text-white'}`}>
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {loading ? <Spinner /> : (
        <>
          {activeTab === 'my' && (
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h3 className="text-white font-medium">My Expenses</h3>
              </div>
              {myExpenses.length === 0 ? (
                <div className="p-10 text-center text-gray-500">
                  <Receipt size={36} className="mx-auto mb-3 opacity-30" />
                  <p>No expenses submitted yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-border">
                        <th className="px-5 py-3 text-left">Title</th>
                        <th className="px-5 py-3 text-left">Category</th>
                        <th className="px-5 py-3 text-left">Amount</th>
                        <th className="px-5 py-3 text-left">Date</th>
                        <th className="px-5 py-3 text-left">Status</th>
                        <th className="px-5 py-3 text-left">Receipt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myExpenses.map((exp) => (
                        <tr key={exp.id} className="border-b border-border/50 hover:bg-surface-2/50 transition-colors">
                          <td className="px-5 py-3 text-white text-sm">{exp.title}</td>
                          <td className="px-5 py-3"><CategoryBadge category={exp.category} /></td>
                          <td className="px-5 py-3 text-white text-sm font-medium">&#8358;{exp.amount.toLocaleString()}</td>
                          <td className="px-5 py-3 text-gray-400 text-sm">{format(parseISO(exp.date), 'MMM d, yyyy')}</td>
                          <td className="px-5 py-3"><StatusBadge status={exp.status} /></td>
                          <td className="px-5 py-3">
                            {exp.receiptUrl ? (
                              <a href={exp.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline text-xs flex items-center gap-1">
                                <Receipt size={12} /> View
                              </a>
                            ) : <span className="text-gray-600 text-xs">None</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'pending' && (
            <div className="space-y-4">
              {pendingTeamExpenses.length === 0 ? (
                <div className="bg-surface border border-border rounded-xl p-10 text-center text-gray-500">
                  <CheckCircle size={36} className="mx-auto mb-3 text-success opacity-50" />
                  <p>No pending expenses</p>
                </div>
              ) : pendingTeamExpenses.map((exp) => (
                <div key={exp.id} className="bg-surface border border-border rounded-xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 gradient-accent rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0">
                        {(exp.user?.name ?? '?').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-white font-medium">{exp.user?.name}</p>
                        <p className="text-gray-500 text-xs">{exp.user?.department}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-white">&#8358;{exp.amount.toLocaleString()}</p>
                      <CategoryBadge category={exp.category} />
                    </div>
                  </div>
                  <p className="mt-3 text-white font-medium">{exp.title}</p>
                  {exp.description && <p className="mt-1 text-gray-400 text-sm">{exp.description}</p>}
                  {exp.receiptUrl && (
                    <a href={exp.receiptUrl} target="_blank" rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-accent text-xs hover:underline">
                      <Receipt size={12} /> View Receipt
                    </a>
                  )}
                  <div className="mt-4 flex gap-3">
                    <Button variant="success" size="sm" className="flex-1" onClick={() => handleApprove(exp.id)}>
                      <CheckCircle size={14} /> Approve
                    </Button>
                    <Button variant="destructive" size="sm" className="flex-1" onClick={() => setRejectTarget(exp.id)}>
                      <XCircle size={14} /> Reject
                    </Button>
                  </div>
                </div>
              ))}

              {/* Monthly summary chart */}
              {summary.length > 0 && (
                <div className="bg-surface border border-border rounded-xl p-5">
                  <h3 className="text-white font-medium mb-4">Monthly Summary by Category</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={summary}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3e" vertical={false} />
                      <XAxis dataKey="category" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: 8 }} labelStyle={{ color: '#fff' }} />
                      <Bar dataKey="total" fill="#6C63FF" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {activeTab === 'all' && (
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-border">
                      <th className="px-5 py-3 text-left">Employee</th>
                      <th className="px-5 py-3 text-left">Title</th>
                      <th className="px-5 py-3 text-left">Category</th>
                      <th className="px-5 py-3 text-left">Amount</th>
                      <th className="px-5 py-3 text-left">Date</th>
                      <th className="px-5 py-3 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamExpenses.length === 0 ? (
                      <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-500">No expenses found</td></tr>
                    ) : teamExpenses.map((exp) => (
                      <tr key={exp.id} className="border-b border-border/50 hover:bg-surface-2/50 transition-colors">
                        <td className="px-5 py-3">
                          <p className="text-white text-sm font-medium">{exp.user?.name}</p>
                          <p className="text-gray-500 text-xs">{exp.user?.department}</p>
                        </td>
                        <td className="px-5 py-3 text-white text-sm">{exp.title}</td>
                        <td className="px-5 py-3"><CategoryBadge category={exp.category} /></td>
                        <td className="px-5 py-3 text-white text-sm">&#8358;{exp.amount.toLocaleString()}</td>
                        <td className="px-5 py-3 text-gray-400 text-sm">{format(parseISO(exp.date), 'MMM d, yyyy')}</td>
                        <td className="px-5 py-3"><StatusBadge status={exp.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <NewExpenseDialog open={newExpenseOpen} onClose={() => setNewExpenseOpen(false)} onSuccess={loadData} />
      <RejectDialog open={!!rejectTarget} onClose={() => setRejectTarget(null)} onConfirm={handleReject} />
    </div>
  );
}
