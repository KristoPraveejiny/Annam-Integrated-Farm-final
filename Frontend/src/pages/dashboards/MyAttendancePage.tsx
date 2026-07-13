import { useEffect, useMemo, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { SectionHeading } from '../../components/ui/SectionHeading';
import { FiCalendar, FiClock, FiSend, FiTrendingUp } from 'react-icons/fi';

type AttendanceRow = {
  id: string;
  date: string;
  task_title?: string | null;
  session?: string | null;
  shift_status?: string | null;
  total_hours?: number | string | null;
  shift_wage_earned?: number | string | null;
  overtime_pay?: number | string | null;
};

type Summary = {
  completedShifts: number;
  equivalentPresentDays: number;
  attendancePercentage: number;
  attendanceStatus: string;
  morningShifts: number;
  afternoonShifts: number;
  eveningShifts: number;
  totalWorkingHours: number;
  shiftWageEarned: number;
  overtimePay: number;
  grossSalary: number;
  netSalary: number;
};

type Advance = {
  id: string;
  amount: number;
  reason: string;
  status: string;
  payroll_month: string;
  payment_method?: string | null;
  account_details?: string | null;
  reviewed_at?: string | null;
};

export default function MyAttendancePage() {
  const [month, setMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [summary, setSummary] = useState<Summary | null>(null);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRow | null>(null);
  const [attendances, setAttendances] = useState<AttendanceRow[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [loading, setLoading] = useState(true);
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceReason, setAdvanceReason] = useState('');
  const [advancePaymentMethod, setAdvancePaymentMethod] = useState('Cash');
  const [advanceAccountDetails, setAdvanceAccountDetails] = useState('');
  const [requestMonth, setRequestMonth] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const tokenRaw = localStorage.getItem('token');
      const token = tokenRaw && tokenRaw.startsWith('"') ? tokenRaw.slice(1, -1) : tokenRaw;

      const [attendanceRes, advanceRes] = await Promise.all([
        fetch(`/api/attendance/my?month=${Number(month)}&year=${year}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/salary/advances', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const attendanceData = await attendanceRes.json();
      const advanceData = await advanceRes.json();

      setSummary(attendanceData.summary || null);
      setTodayAttendance(attendanceData.todayAttendance || null);
      setAttendances(attendanceData.attendances || []);
      setAdvances(advanceData || []);
    } finally {
      setLoading(false);
    }
  };

  const submitAdvance = async () => {
    const tokenRaw = localStorage.getItem('token');
    const token = tokenRaw && tokenRaw.startsWith('"') ? tokenRaw.slice(1, -1) : tokenRaw;
    await fetch('/api/salary/advances/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        amount: Number(advanceAmount),
        reason: advanceReason,
        payrollMonth: requestMonth,
        paymentMethod: advancePaymentMethod,
        accountDetails: advanceAccountDetails,
      }),
    });
    setAdvanceAmount('');
    setAdvanceReason('');
    setAdvanceAccountDetails('');
    fetchData();
  };

  const monthStats = useMemo(() => ([
    { label: 'Completed Shifts', value: String(summary?.completedShifts ?? 0) },
    { label: 'Equivalent Present Days', value: Number(summary?.equivalentPresentDays ?? 0).toFixed(2) },
    { label: 'Attendance %', value: `${Number(summary?.attendancePercentage ?? 0).toFixed(2)}%` },
    { label: 'Status', value: summary?.attendanceStatus || 'Absent' },
  ]), [summary]);

  return (
    <div className="space-y-6 pb-10">
      <SectionHeading
        eyebrow="Worker"
        title="My Attendance"
        description="Track today's work, monthly attendance, and salary advance requests."
        tone="light"
      />

      <Card title="Month View" subtitle="Select the period you want to review">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Month" value={month} onChange={(e) => setMonth(e.target.value)} type="number" min="1" max="12" />
          <Field label="Year" value={year} onChange={(e) => setYear(e.target.value)} type="number" />
          <Field label="Payroll Month" value={requestMonth} onChange={(e) => setRequestMonth(e.target.value)} type="month" />
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {monthStats.map((item) => (
          <Card key={item.label} className="bg-slate-50 border-slate-200">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
            <p className="mt-2 text-3xl font-black text-slate-900">{item.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <Card title="Today's Attendance" subtitle="Current day session status">
          {todayAttendance ? (
            <div className="space-y-3">
              <Line label="Date" value={new Date(todayAttendance.date).toLocaleDateString()} />
              <Line label="Task" value={todayAttendance.task_title || 'Task session'} />
              <Line label="Session" value={todayAttendance.session || 'N/A'} />
              <Line label="Hours" value={Number(todayAttendance.total_hours || 0).toFixed(2)} />
              <Line label="Status" value={todayAttendance.shift_status || 'Pending'} />
            </div>
          ) : (
            <p className="text-slate-500">No attendance recorded for today yet.</p>
          )}
        </Card>

        <Card title="Salary Advance" subtitle="Request a mid-month payment">
          <div className="space-y-4">
            <Field label="Amount" value={advanceAmount} onChange={(e) => setAdvanceAmount(e.target.value)} type="number" min="1" />
            <Field label="Reason" value={advanceReason} onChange={(e) => setAdvanceReason(e.target.value)} placeholder="Why do you need the advance?" />
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-500">Payment Method</span>
              <select value={advancePaymentMethod} onChange={(e) => setAdvancePaymentMethod(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-emerald-500">
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Online">Online</option>
              </select>
            </label>
            {(advancePaymentMethod === 'Bank Transfer' || advancePaymentMethod === 'Online') && (
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-500">Account Details</span>
                <textarea 
                  value={advanceAccountDetails} 
                  onChange={(e) => setAdvanceAccountDetails(e.target.value)} 
                  placeholder="Enter Bank Account / UPI / Phone Number details..."
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-emerald-500 min-h-[80px]"
                />
              </label>
            )}
            <button onClick={submitAdvance} className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 font-semibold text-white">
              <FiSend /> Request Advance
            </button>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
              Approved advances will be deducted from the next payroll automatically.
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <Card title="Attendance Calendar" subtitle="Monthly completed shift history">
          {loading ? (
            <p className="text-slate-500">Loading...</p>
          ) : (
            <div className="space-y-2">
              {attendances.map((row) => (
                <div key={row.id} className="flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-3">
                  <div>
                    <p className="font-semibold text-slate-900">{new Date(row.date).toLocaleDateString()}</p>
                    <p className="text-sm text-slate-500">{row.task_title || 'Task session'} - {row.session || 'N/A'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-900">{Number(row.total_hours || 0).toFixed(2)} hrs</p>
                    <p className="text-sm text-emerald-600">{row.shift_status || 'Pending'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Advance History" subtitle="Your salary advance requests">
          <div className="space-y-3">
            {advances.length === 0 ? (
              <p className="text-slate-500">No advance requests yet.</p>
            ) : (
              advances.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-100 p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-900">Rs. {Number(item.amount).toFixed(2)}</p>
                    <span className="text-sm font-semibold text-emerald-600">
                      {item.status === 'Approved' ? 'Advance Paid' : item.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{item.reason}</p>
                  {(item.payment_method === 'Bank Transfer' || item.payment_method === 'Online') && (
                    <div className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-500">
                      <strong>Method:</strong> {item.payment_method}<br/>
                      <strong>Details:</strong> {item.account_details || 'N/A'}
                    </div>
                  )}
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-400">{item.payroll_month}</p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, className, ...rest } = props;
  return (
    <label className="space-y-2">
      <span className="text-sm font-semibold text-slate-500">{label}</span>
      <input
        {...rest}
        className={`w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-emerald-500 ${className || ''}`}
      />
    </label>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}
