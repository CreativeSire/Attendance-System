import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  DollarSign, 
  FileSpreadsheet,
  Clock,
  TrendingUp,
  AlertTriangle,
  User,
  Calculator,
  ChevronDown,
  ChevronUp,
  FileText
} from 'lucide-react';
import { format, subMonths } from 'date-fns';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { cn } from '@/lib/utils';

interface PayrollExportProps {
  attendance: any;
}

export function PayrollExport({ attendance }: PayrollExportProps) {
  const { employees } = useAuth();
  const { toast } = useToast();
  const [selectedPeriod, setSelectedPeriod] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [detailsOpen, setDetailsOpen] = useState(false);

  const payrollData = useMemo(() => {
    const list = selectedEmployee === 'all' 
      ? employees.filter(e => e.hourlyRate || e.monthlySalary)
      : employees.filter(e => e.id === selectedEmployee);

    return list.map(emp => {
      const salary = emp.monthlySalary || (emp.hourlyRate || 0) * 8 * 22;
      return {
        ...attendance.calculatePayroll(emp.id, salary, selectedPeriod),
        department: emp.department || 'Staff',
        userName: emp.name
      };
    });
  }, [attendance, employees, selectedPeriod, selectedEmployee]);

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(payrollData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Payroll');
    XLSX.writeFile(wb, `payroll-${selectedPeriod}.xlsx`);
    toast('Excel downloaded', 'success');
  };

  // Task 3: Automated PDF Pay Slips
  const generatePDF = (entry: any) => {
    const doc = new jsPDF() as any;
    doc.setFontSize(20);
    doc.text("DALA ATTENDANCE - PAYSLIP", 105, 20, { align: "center" });
    
    doc.setFontSize(12);
    doc.text(`Employee: ${entry.userName}`, 20, 40);
    doc.text(`Period: ${format(new Date(selectedPeriod + '-01'), 'MMMM yyyy')}`, 20, 50);
    doc.text(`Department: ${entry.department}`, 20, 60);

    const tableData = [
      ["Description", "Amount"],
      ["Gross Monthly Salary", `N${entry.monthlySalary.toLocaleString()}`],
      ["Days Present", `${entry.presentDays} / 22`],
      ["Gross Earned", `N${entry.grossPay.toLocaleString()}`],
      ["8% Pension Deduction", `-N${entry.pensionContribution.toLocaleString()}`],
      ["PAYE Tax", `-N${entry.payeTax.toLocaleString()}`],
      ["Late Penalties", `-N${entry.latePenalty.toLocaleString()}`],
      ["Expense Reimbursements", `+N${entry.expenseReimbursement.toLocaleString()}`],
      ["", ""],
      ["NET PAY", `N${entry.netPay.toLocaleString()}`]
    ];

    doc.autoTable({
      startY: 70,
      head: [tableData[0]],
      body: tableData.slice(1),
      theme: 'grid',
      headStyles: { fillColor: [108, 99, 255] }
    });

    doc.save(`payslip-${entry.userName}-${selectedPeriod}.pdf`);
  };

  return (
    <div className="space-y-4 pb-20">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[#e0e0f0]">Payroll Export</h2>
        <div className="flex gap-2">
          <Button onClick={exportToExcel} size="sm" variant="outline"><FileSpreadsheet className="w-4 h-4 mr-1" /> Excel</Button>
        </div>
      </div>

      <div className="space-y-3">
        {payrollData.map((entry: any) => (
          <Card key={entry.userId} className="bg-[#1e1e35] border-[#2a2a4a]">
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="font-bold text-[#e0e0f0]">{entry.userName}</p>
                  <p className="text-xs text-[#888]">{entry.department}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-emerald-400">N{entry.netPay.toLocaleString()}</p>
                  <p className="text-[10px] text-[#666]">Net Pay</p>
                </div>
              </div>
              <Button onClick={() => generatePDF(entry)} variant="ghost" className="w-full text-[#6C63FF] border-[#6C63FF]/20 border h-10">
                <FileText className="w-4 h-4 mr-2" /> Download Payslip (PDF)
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
