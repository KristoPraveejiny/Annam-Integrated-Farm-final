import { useEffect, useMemo, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { SectionHeading } from '../../components/ui/SectionHeading';
import { FiDownload, FiFilter, FiPrinter, FiSearch } from 'react-icons/fi';

type AttendanceRow = {
  id: string;
  worker_id: string;
  worker_name: string;
  date: string;
  shift_name: string;
  task_title?: string | null;
  check_in_time?: string | null;
  check_out_time?: string | null;
  total_hours?: number | string | null;
  shift_status?: string | null;
  shift_wage_earned?: number | string | null;
  overtime_pay?: number | string | null;
};

type WorkerSummary = {
  worker_id: string;
  worker_name: string;
  completed_shifts: number;
  active_days: number;
  morning_shifts: number;
  afternoon_shifts: number;
  evening_shifts: number;
  total_working_hours: number;
};

type AttendanceResponse = {
  summary?: {
    completedShifts: number;
    equivalentPresentDays: number;
    attendancePercentage: number;
    attendanceStatus: string;
    total_workers: number;
    completed_tasks: number;
    total_days_in_month: number;
  };
  attendances?: AttendanceRow[];
  workers?: WorkerSummary[];
  calendar?: Array<{ date: string; shift_count: number; present_count: number }>;
};

export default function AttendanceManagementPage() {
  const [month, setMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [search, setSearch] = useState('');
  const [date, setDate] = useState('');
  const [shiftId, setShiftId] = useState('');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AttendanceResponse>({});

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year, search, date, shiftId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const tokenRaw = localStorage.getItem('token');
      const token = tokenRaw && tokenRaw.startsWith('"') ? tokenRaw.slice(1, -1) : tokenRaw;
      const params = new URLSearchParams();
      params.set('month', String(Number(month)));
      params.set('year', year);
      if (search.trim()) params.set('search', search.trim());
      if (date) params.set('date', date);
      if (shiftId) params.set('shiftId', shiftId);

      const res = await fetch(`/api/attendance/manager?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error('API Error');
      }

      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = () => {
    const rows = data.attendances || [];
    const headers = ['Date', 'Worker', 'Shift', 'Task', 'Hours', 'Status', 'Shift Wage', 'Overtime'];
    const csv = [
      headers.join(','),
      ...rows.map((row) => [
        row.date,
        escapeCsv(row.worker_name),
        escapeCsv(row.shift_name),
        escapeCsv(row.task_title || ''),
        Number(row.total_hours || 0).toFixed(2),
        escapeCsv(row.shift_status || ''),
        Number(row.shift_wage_earned || 0).toFixed(2),
        Number(row.overtime_pay || 0).toFixed(2),
      ].join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `attendance-${year}-${month}.csv`;
    link.click();
  };

  const handleRefresh = () => {
    setMonth(String(new Date().getMonth() + 1).padStart(2, '0'));
    setYear(String(new Date().getFullYear()));
    setSearch('');
    setDate('');
    setShiftId('');
  };

  const exportPdf = () => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.onload = () => {
      const element = document.getElementById('attendance-report');
      if (element && (window as any).html2pdf) {
        (window as any).html2pdf().set({
          margin: 10,
          filename: `attendance-${year}-${month}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
        }).from(element).save();
      }
    };
    document.body.appendChild(script);
  };

  const summaryCards = useMemo(() => ([
    { label: 'Completed Shifts', value: String(data.summary?.completedShifts ?? 0) },
    { label: 'Completed Tasks', value: String(data.summary?.completed_tasks ?? 0) },
    { label: 'Equivalent Present Days', value: Number(data.summary?.equivalentPresentDays ?? 0).toFixed(2) },
    { label: 'Attendance %', value: `${Number(data.summary?.attendancePercentage ?? 0).toFixed(2)}%` },
    { label: 'Workers Tracked', value: String(data.summary?.total_workers ?? 0) },
  ]), [data.summary]);

  return (
    <div id="attendance-report" className="space-y-6 pb-10">
      <SectionHeading
        eyebrow="Workforce"
        title="Attendance Management"
        description="Track daily, monthly, and shift attendance across the farm."
        tone="light"
      />

      <Card title="Filters" subtitle="Search and refine attendance records">
        <div className="grid gap-4 lg:grid-cols-5" data-html2canvas-ignore>
          <Input value={month} onChange={(e) => setMonth(e.target.value)} label="Month" type="number" min="1" max="12" />
          <Input value={year} onChange={(e) => setYear(e.target.value)} label="Year" type="number" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} label="Search worker" icon={<FiSearch />} placeholder="Worker name" />
          <Input value={date} onChange={(e) => setDate(e.target.value)} label="Date" type="date" />
          <Input value={shiftId} onChange={(e) => setShiftId(e.target.value)} label="Shift ID" icon={<FiFilter />} placeholder="Optional" />
        </div>
        <div className="mt-4 flex flex-wrap gap-3" data-html2canvas-ignore>
          <button onClick={handleRefresh} className="rounded-full bg-emerald-600 px-4 py-2 font-semibold text-white">Refresh</button>
          <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 font-semibold text-white"><FiDownload /> Export Excel/CSV</button>
          <button onClick={exportPdf} className="inline-flex items-center gap-2 rounded-full bg-slate-700 px-4 py-2 font-semibold text-white"><FiPrinter /> Export PDF</button>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <Card key={card.label}>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">{card.label}</p>
            <p className="mt-2 text-3xl font-black text-white">{card.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <Card title="Daily Attendance" subtitle="Shift level history for the selected month">
          {loading ? (
            <p className="text-slate-500">Loading...</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-100">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Worker</th>
                    <th className="px-4 py-3">Shift</th>
                    <th className="px-4 py-3">Task</th>
                    <th className="px-4 py-3">Hours</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Wage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {(data.attendances || []).map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3 font-medium text-slate-900">{new Date(row.date).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-slate-700">{row.worker_name}</td>
                      <td className="px-4 py-3 text-slate-700">{row.shift_name}</td>
                      <td className="px-4 py-3 text-slate-600">{row.task_title || 'Task session'}</td>
                      <td className="px-4 py-3 text-slate-700">{Number(row.total_hours || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-slate-700">{row.shift_status}</td>
                      <td className="px-4 py-3 text-slate-700">Rs. {Number(row.shift_wage_earned || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Worker Summary" subtitle="Monthly attendance by worker">
          {!search.trim() ? (
            <p className="text-slate-500">Search for a worker to view their details.</p>
          ) : (
            <div className="space-y-3">
              {(data.workers || []).map((worker) => (
                <div key={worker.worker_id} className="rounded-2xl border border-slate-100 p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-white">{worker.worker_name}</p>
                    <p className="text-sm text-slate-300">{worker.completed_shifts} shifts</p>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-300">
                    <span>Morning: {worker.morning_shifts}</span>
                    <span>Afternoon: {worker.afternoon_shifts}</span>
                    <span>Evening: {worker.evening_shifts}</span>
                    <span>Hours: {Number(worker.total_working_hours).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string; icon?: React.ReactNode }) {
  const { label, icon, className, ...rest } = props;
  return (
    <label className="space-y-2">
      <span className="text-sm font-semibold text-slate-300">{label}</span>
      <div className="relative">
        {icon ? <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span> : null}
        <input
          {...rest}
          className={`w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-emerald-500 ${icon ? 'pl-10' : ''} ${className || ''}`}
        />
      </div>
    </label>
  );
}

function escapeCsv(value: string) {
  const needsWrap = /[,"\n]/.test(value);
  const safe = String(value).replace(/"/g, '""');
  return needsWrap ? `"${safe}"` : safe;
}
