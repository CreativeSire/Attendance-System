import { useEffect, useState, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { Search, Plus, Mail, Phone, Calendar, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { employeesApi } from '@/api/employees';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import type { User } from '@/types';
import { getInitials } from '@/lib/utils';

const employeeSchema = z.object({
  name: z.string().min(2, 'Name required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Min 6 characters'),
  role: z.string().min(1, 'Required'),
  department: z.string().min(1, 'Required'),
  position: z.string().min(1, 'Required'),
  phone: z.string().optional(),
  baseSalary: z.coerce.number().optional(),
});

type EmployeeForm = z.infer<typeof employeeSchema>;

function Spinner() {
  return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function AddEmployeeDialog({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<EmployeeForm>({
    resolver: zodResolver(employeeSchema),
  });

  const onSubmit = async (data: EmployeeForm) => {
    try {
      await employeesApi.create(data);
      toast.success('Employee added!');
      reset();
      onSuccess();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to add employee');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-surface border-border text-white max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add Employee</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-gray-300">Full Name <span className="text-danger">*</span></Label>
              <Input {...register('name')} placeholder="John Doe" className="bg-surface-2 border-border text-white placeholder:text-gray-500" />
              {errors.name && <p className="text-danger text-xs">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Email <span className="text-danger">*</span></Label>
              <Input type="email" {...register('email')} placeholder="john@company.com" className="bg-surface-2 border-border text-white placeholder:text-gray-500" />
              {errors.email && <p className="text-danger text-xs">{errors.email.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">Password <span className="text-danger">*</span></Label>
            <Input type="password" {...register('password')} placeholder="Temporary password" className="bg-surface-2 border-border text-white placeholder:text-gray-500" />
            {errors.password && <p className="text-danger text-xs">{errors.password.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-gray-300">Role <span className="text-danger">*</span></Label>
              <select {...register('role')} className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent">
                <option value="">Select...</option>
                <option value="employee">Employee</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
              {errors.role && <p className="text-danger text-xs">{errors.role.message}</p>}
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Department <span className="text-danger">*</span></Label>
              <Input {...register('department')} placeholder="Engineering" className="bg-surface-2 border-border text-white placeholder:text-gray-500" />
              {errors.department && <p className="text-danger text-xs">{errors.department.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-gray-300">Position <span className="text-danger">*</span></Label>
              <Input {...register('position')} placeholder="Software Engineer" className="bg-surface-2 border-border text-white placeholder:text-gray-500" />
              {errors.position && <p className="text-danger text-xs">{errors.position.message}</p>}
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Phone</Label>
              <Input {...register('phone')} placeholder="+234..." className="bg-surface-2 border-border text-white placeholder:text-gray-500" />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">Basic Salary (&#8358;)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">&#8358;</span>
              <Input type="number" {...register('baseSalary')} placeholder="0" className="pl-7 bg-surface-2 border-border text-white placeholder:text-gray-500" />
            </div>
          </div>

          <Button type="submit" className="w-full gradient-accent text-white" isLoading={isSubmitting}>
            Add Employee
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EmployeeDetailPanel({ employee, onClose }: { employee: User; onClose: () => void }) {
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="bg-surface border-border text-white max-w-md">
        <DialogHeader><DialogTitle>Employee Details</DialogTitle></DialogHeader>
        <div className="space-y-5 pt-2">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 gradient-accent rounded-2xl flex items-center justify-center text-white text-xl font-bold shrink-0">
              {getInitials(employee.name)}
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">{employee.name}</h3>
              <p className="text-gray-400">{employee.position}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={employee.role === 'admin' ? 'default' : employee.role === 'manager' ? 'success' : 'secondary'} className="text-xs">
                  {employee.role}
                </Badge>
                <Badge variant="secondary" className="text-xs">{employee.department}</Badge>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {[
              { icon: Mail, label: 'Email', value: employee.email },
              { icon: Phone, label: 'Phone', value: employee.phone ?? '--' },
              { icon: Calendar, label: 'Joined', value: employee.createdAt ? format(parseISO(employee.createdAt), 'MMMM d, yyyy') : '--' },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-3 p-3 bg-surface-2 rounded-lg">
                <Icon size={16} className="text-gray-500 shrink-0" />
                <div>
                  <p className="text-gray-500 text-xs">{label}</p>
                  <p className="text-white text-sm">{value}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-surface-2 rounded-lg p-3 text-center">
              <p className="text-success font-bold text-xl">{employee.annualLeaveBalance}</p>
              <p className="text-gray-500 text-xs">Annual</p>
            </div>
            <div className="bg-surface-2 rounded-lg p-3 text-center">
              <p className="text-danger font-bold text-xl">{employee.sickLeaveBalance}</p>
              <p className="text-gray-500 text-xs">Sick</p>
            </div>
            <div className="bg-surface-2 rounded-lg p-3 text-center">
              <p className="text-warning font-bold text-xl">{employee.casualLeaveBalance}</p>
              <p className="text-gray-500 text-xs">Casual</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EmployeeCard({ employee, onClick }: { employee: User; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="bg-surface border border-border rounded-xl p-5 cursor-pointer hover:border-accent/50 hover:shadow-lg hover:shadow-accent/5 transition-all"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 gradient-accent rounded-xl flex items-center justify-center text-white font-bold">
          {getInitials(employee.name)}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 bg-success rounded-full" />
          <span className="text-success text-xs">Active</span>
        </div>
      </div>
      <h3 className="text-white font-semibold">{employee.name}</h3>
      <p className="text-gray-400 text-sm mt-0.5">{employee.position}</p>
      <p className="text-gray-500 text-xs mt-1">{employee.department}</p>
      <div className="mt-3 pt-3 border-t border-border space-y-1.5">
        <div className="flex items-center gap-2 text-gray-500 text-xs">
          <Mail size={11} />
          <span className="truncate">{employee.email}</span>
        </div>
        {employee.phone && (
          <div className="flex items-center gap-2 text-gray-500 text-xs">
            <Phone size={11} />
            <span>{employee.phone}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-gray-500 text-xs">
          <Calendar size={11} />
          <span>{employee.createdAt ? format(parseISO(employee.createdAt), 'MMM yyyy') : '--'}</span>
        </div>
      </div>
    </div>
  );
}

export default function Team() {
  const [employees, setEmployees] = useState<User[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<User | null>(null);

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const [empRes, deptRes] = await Promise.all([
        employeesApi.getAll({ search: search || undefined, department: deptFilter || undefined, limit: 100 }),
        employeesApi.getDepartments(),
      ]);
      setEmployees(((empRes as { data: { data: User[] } }).data?.data) ?? []);
      setDepartments(((deptRes as { data: string[] }).data) ?? []);
    } finally {
      setLoading(false);
    }
  }, [search, deptFilter]);

  useEffect(() => {
    const timeout = setTimeout(loadEmployees, 300);
    return () => clearTimeout(timeout);
  }, [loadEmployees]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Team</h1>
          <p className="text-gray-400 text-sm mt-1">{employees.length} employees</p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="gradient-accent text-white">
          <Plus size={16} /> Add Employee
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employees..."
            className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-lg text-white placeholder:text-gray-500 text-sm focus:outline-none focus:border-accent"
          />
        </div>
        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="bg-surface border border-border rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-accent"
        >
          <option value="">All Departments</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {loading ? <Spinner /> : employees.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-10 text-center text-gray-500">
          <ExternalLink size={36} className="mx-auto mb-3 opacity-30" />
          <p>No employees found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {employees.map((emp) => (
            <EmployeeCard key={emp.id} employee={emp} onClick={() => setSelectedEmployee(emp)} />
          ))}
        </div>
      )}

      <AddEmployeeDialog open={addOpen} onClose={() => setAddOpen(false)} onSuccess={loadEmployees} />
      {selectedEmployee && (
        <EmployeeDetailPanel employee={selectedEmployee} onClose={() => setSelectedEmployee(null)} />
      )}
    </div>
  );
}
