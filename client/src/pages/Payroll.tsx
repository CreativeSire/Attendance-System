import { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { payrollApi } from '@/api/payroll';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import type { PayrollCalculation } from '@/types';
import { MONTHS } from '@/lib/utils';

function Spinner() {
  return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function MonthYearSelector({ month, year, onChange }: { month: number; year: number; onChange: (m: number, y: number) => void }) {
  const prev = () => { if (month === 1) onChange(12, year - 1); else onChange(month - 1, year); };
  const next = () => { if (month === 12) onChange(1, year + 1); else onChange(month + 1, year); };
  return (
    <div className="flex items-center gap-2">
      <button onClick={prev} className="p-2 rounded-lg bg-surface-2 text-gray-400 hover:text-white transition-colors">
        <ChevronLeft size={16} />
      </button>
      <span className="text-white font-medium px-2">{MONTHS[month - 1]} {year}</span>
      <button onClick={next} className="p-2 rounded-lg bg-surface-2 text-gray-400 hover:text-white transition-colors">
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

function PayslipCard({ payroll, userName }: { payroll: PayrollCalculation; userName: string }) {
  const generatePDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();

    // Header
    doc.setFillColor(15, 15, 26);
    doc.rect(0, 0, pageW, 45, 'F');
    doc.setTextColor(108, 99, 255);
    doc.setFontSize(24);
    doc.text('DALA', 20, 25);
    doc.setTextColor(200, 200, 200);
    doc.setFontSize(10);
    doc.text('Workforce Intelligence Platform', 20, 35);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.text('PAYSLIP', pageW - 20, 22, { align: 'right' });
    doc.setFontSize(10);
    doc.text(`${MONTHS[payroll.month - 1]} ${payroll.year}`, pageW - 20, 32, { align: 'right' });

    doc.setTextColor(50, 50, 50);
    let y = 60;

    // Employee info
    doc.setFontSize(11);
    doc.setFont('','bold');
    doc.text('Employee Details', 20, y); y += 8;
    doc.setFont('','normal');
    doc.setFontSize(10);
    doc.text(`Name: ${userName}`, 20, y); y += 6;
    doc.text(`Period: ${MONTHS[payroll.month - 1]} ${payroll.year}`, 20, y); y += 15;

    // Earnings
    doc.setFont('','bold');
    doc.setFontSize(11);
    doc.text('Earnings', 20, y); y += 8;
    doc.setFont('','normal');
    doc.setFontSize(10);
    doc.text(`Basic Salary:`, 20, y); doc.text(`\u20A6${payroll.baseSalary?.toLocaleString() ?? 0}`, 130, y); y += 6;
    doc.text(`Overtime Pay:`, 20, y); doc.text(`\u20A6${payroll.overtimePay?.toLocaleString() ?? 0}`, 130, y); y += 6;
    (payroll.additions ?? []).forEach((a) => {
      doc.text(`${a.name}:`, 20, y); doc.text(`\u20A6${a.amount?.toLocaleString() ?? 0}`, 130, y); y += 6;
    });
    doc.setFont('','bold');
    doc.text(`Gross Pay:`, 20, y); doc.text(`\u20A6${payroll.grossPay?.toLocaleString() ?? 0}`, 130, y); y += 12;

    // Deductions
    doc.setFont('','normal');
    doc.text('Deductions', 20, y); y += 8;
    doc.setFont('','normal');
    (payroll.deductions ?? []).forEach((d) => {
      doc.text(`${d.name}:`, 20, y); doc.text(`-\u20A6${d.amount?.toLocaleString() ?? 0}`, 130, y); y += 6;
    });
    doc.text(`Tax:`, 20, y); doc.text(`-\u20A6${payroll.tax?.toLocaleString() ?? 0}`, 130, y); y += 12;

    // Net pay
    doc.setFillColor(108, 99, 255);
    doc.rect(15, y - 2, pageW - 30, 16, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('','bold');
    doc.setFontSize(13);
    doc.text('NET PAY:', 20, y + 8);
    doc.text(`\u20A6${payroll.netPay?.toLocaleString() ?? 0}`, pageW - 20, y + 8, { align: 'right' });

    doc.save(`payslip-${userName.replace(/\s+/g, '-')}-${MONTHS[payroll.month - 1]}-${payroll.year}.pdf`);
    toast.success('Payslip downloaded!');
  };

  const Row = ({ label, value, bold }: { label: string; value: string; bold?: boolean }) => (
    <div className={`flex justify-between py-2 border-b border-border/50 text-sm ${bold ? 'font-semibold' : ''}`}>
      <span className="text-gray-400">{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="gradient-accent px-6 py-5 flex items-center justify-between">
        <div>
          <p className="text-white/70 text-sm">Payslip for</p>
          <h2 className="text-white font-bold text-xl">{MONTHS[payroll.month - 1]} {payroll.year}</h2>
        </div>
        <Button variant="secondary" size="sm" onClick={generatePDF}>
          <Download size={14} /> Download PDF
        </Button>
      </div>

      <div className="p-6 space-y-6">
        {/* Earnings */}
        <div>
          <h3 className="text-gray-400 text-xs uppercase tracking-wider font-semibold mb-3">Earnings</h3>
          <Row label="Basic Salary" value={`\u20A6${(payroll.baseSalary ?? 0).toLocaleString()}`} />
          <Row label="Overtime Pay" value={`\u20A6${(payroll.overtimePay ?? 0).toLocaleString()}`} />
          {(payroll.additions ?? []).map((a) => (
            <Row key={a.name} label={a.name} value={`\u20A6${a.amount.toLocaleString()}`} />
          ))}
          <Row label="Gross Pay" value={`\u20A6${(payroll.grossPay ?? 0).toLocaleString()}`} bold />
        </div>

        {/* Deductions */}
        <div>
          <h3 className="text-gray-400 text-xs uppercase tracking-wider font-semibold mb-3">Deductions</h3>
          {(payroll.deductions ?? []).map((d) => (
            <Row key={d.name} label={d.name} value={`-\u20A6${d.amount.toLocaleString()}`} />
          ))}
          <Row label="PAYE Tax" value={`-\u20A6${(payroll.tax ?? 0).toLocaleString()}`} />
          <Row label="Pension (8%)" value={`-\u20A6${Math.round((payroll.baseSalary ?? 0) * 0.08).toLocaleString()}`} />
          <Row label="NHF (2.5%)" value={`-\u20A6${Math.round((payroll.baseSalary ?? 0) * 0.025).toLocaleString()}`} />
        </div>

        {/* Net Pay */}
        <div className="bg-accent/10 border border-accent/30 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm">Net Pay</p>
            <p className="text-4xl font-bold text-accent mt-1">&#8358;{(payroll.netPay ?? 0).toLocaleString()}</p>
          </div>
          <div className="text-right text-sm text-gray-400 space-y-1">
            <p>Present: <span className="text-white">{payroll.presentDays}</span></p>
            <p>Working days: <span className="text-white">{payroll.workingDays}</span></p>
            <p>Overtime: <span className="text-white">{payroll.overtimeHours}h</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Payroll() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'manager';
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [myPayroll, setMyPayroll] = useState<PayrollCalculation | null>(null);
  const [teamPayroll, setTeamPayroll] = useState<PayrollCalculation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'my' | 'team'>('my');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const myRes = await payrollApi.getMyPayroll({ month, year });
      setMyPayroll((myRes as { data: PayrollCalculation }).data ?? null);

      if (isAdmin) {
        const teamRes = await payrollApi.getTeamPayroll({ month, year, limit: 100 });
        setTeamPayroll(((teamRes as { data: { data: PayrollCalculation[] } }).data?.data) ?? []);
      }
    } catch {
      setMyPayroll(null);
    } finally {
      setLoading(false);
    }
  }, [month, year, isAdmin]);

  useEffect(() => { loadData(); }, [loadData]);

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(teamPayroll.map((p) => ({
      'Employee': p.user?.name ?? '--',
      'Department': p.user?.department ?? '--',
      'Days Present': p.presentDays,
      'Working Days': p.workingDays,
      'Gross Pay': p.grossPay,
      'Deductions': (p.deductions ?? []).reduce((s, d) => s + d.amount, 0),
      'Tax': p.tax,
      'Net Pay': p.netPay,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Payroll');
    XLSX.writeFile(wb, `payroll-${MONTHS[month - 1]}-${year}.xlsx`);
    toast.success('Excel downloaded!');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Payroll</h1>
          <p className="text-gray-400 text-sm mt-1">View payslips and salary information</p>
        </div>
        <MonthYearSelector month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y); }} />
      </div>

      {isAdmin && (
        <div className="flex bg-surface-2 rounded-xl p-1 gap-1 w-fit">
          {(['my', 'team'] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize
                ${activeTab === tab ? 'gradient-accent text-white shadow' : 'text-gray-400 hover:text-white'}`}>
              {tab === 'my' ? 'My Payslip' : 'Team Payroll'}
            </button>
          ))}
        </div>
      )}

      {loading ? <Spinner /> : (
        <>
          {activeTab === 'my' && (
            myPayroll ? (
              <PayslipCard payroll={myPayroll} userName={user?.name ?? 'Employee'} />
            ) : (
              <div className="bg-surface border border-border rounded-xl p-10 text-center text-gray-500">
                <p>No payroll data for {MONTHS[month - 1]} {year}</p>
                <p className="text-xs mt-2">Payroll is generated at month end</p>
              </div>
            )
          )}

          {activeTab === 'team' && isAdmin && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={exportExcel}>
                  <Download size={14} /> Export Excel
                </Button>
              </div>
              <div className="bg-surface border border-border rounded-xl overflow-hidden">
                {teamPayroll.length === 0 ? (
                  <div className="p-10 text-center text-gray-500">No team payroll data for this period</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-border">
                          <th className="px-5 py-3 text-left">Employee</th>
                          <th className="px-5 py-3 text-right">Present</th>
                          <th className="px-5 py-3 text-right">Gross</th>
                          <th className="px-5 py-3 text-right">Deductions</th>
                          <th className="px-5 py-3 text-right">Tax</th>
                          <th className="px-5 py-3 text-right">Net Pay</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teamPayroll.map((p) => (
                          <tr key={p.id} className="border-b border-border/50 hover:bg-surface-2/50 transition-colors">
                            <td className="px-5 py-3">
                              <p className="text-white text-sm font-medium">{p.user?.name}</p>
                              <p className="text-gray-500 text-xs">{p.user?.department}</p>
                            </td>
                            <td className="px-5 py-3 text-gray-300 text-sm text-right">{p.presentDays}/{p.workingDays}</td>
                            <td className="px-5 py-3 text-gray-300 text-sm text-right">&#8358;{(p.grossPay ?? 0).toLocaleString()}</td>
                            <td className="px-5 py-3 text-danger text-sm text-right">-&#8358;{(p.deductions ?? []).reduce((s, d) => s + d.amount, 0).toLocaleString()}</td>
                            <td className="px-5 py-3 text-warning text-sm text-right">-&#8358;{(p.tax ?? 0).toLocaleString()}</td>
                            <td className="px-5 py-3 text-accent font-bold text-sm text-right">&#8358;{(p.netPay ?? 0).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
