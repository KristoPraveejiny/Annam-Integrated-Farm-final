import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Card } from '../../components/ui/Card';
import { SectionHeading } from '../../components/ui/SectionHeading';
import { FiCalendar, FiCheckCircle, FiClock, FiDollarSign } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';

interface AttendanceRow {
  id: string;
  date: string;
  task_title: string;
  session: string;
  attendance_status: string;
  total_hours?: number | string | null;
  shift_wage_earned?: number | string | null;
  overtime_pay?: number | string | null;
}

interface EarningsSummary {
  payment_month: string;
  month_label: string;
  worker_name: string;
  completed_shifts: number;
  equivalent_present_days: number;
  attendance_percentage: number;
  attendance_status: string;
  morning_shifts: number;
  afternoon_shifts: number;
  evening_shifts: number;
  total_working_hours: number;
  shift_wage_earned: number;
  overtime_pay: number;
  bonus: number;
  deductions: number;
  gross_salary: number;
  net_salary: number;
  paid_salary: number;
}

export default function FarmerAttendancePage() {
  const { t } = useTranslation();
  const [attendances, setAttendances] = useState<AttendanceRow[]>([]);
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState('N/A');

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setDisplayName(String(parsed?.name || parsed?.full_name || parsed?.email || 'N/A'));
      } catch {
        setDisplayName('N/A');
      }
    }

    const fetchHistory = async () => {
      try {
        setLoading(true);
        const tokenRaw = localStorage.getItem('token');
        const token = tokenRaw && tokenRaw.startsWith('"') ? tokenRaw.slice(1, -1) : tokenRaw;

        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        const res = await fetch(`/api/salary/my-earnings?month=${month}&year=${year}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        setAttendances(data.attendances || []);
        setSummary(data.summary || null);
      } catch (err) {
        console.error('Failed to fetch attendance history', err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  return (
    <div className="space-y-6 pb-20">
      <SectionHeading
        eyebrow={t("Attendance")}
        title={t("Daily Attendance")}
        description={t("Your attendance is automatically recorded when a task is approved.") }
        tone="light"
      />

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={t("Current Month")}
          value={summary?.month_label || new Date().toLocaleString(undefined, { month: 'long', year: 'numeric' })}
          icon={<FiCalendar />}
        />
        <MetricCard
          label={t("Completed Shifts")}
          value={String(summary?.completed_shifts ?? 0)}
          icon={<FiCheckCircle />}
        />
        <MetricCard
          label={t("Equivalent Present Days")}
          value={Number(summary?.equivalent_present_days ?? 0).toFixed(2)}
          icon={<FiClock />}
        />
        <MetricCard
          label={t("Attendance Percentage")}
          value={`${Number(summary?.attendance_percentage ?? 0).toFixed(2)}%`}
          icon={<FiDollarSign />}
        />
      </div>

      <Card title={t("Attendance Tracking Info")} subtitle={t("How it works")} className="!aspect-auto w-full max-w-3xl self-start">
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-100">
          <div className="flex items-start gap-3">
            <FiCheckCircle className="mt-1 text-xl text-emerald-400" />
            <div>
              <h4 className="mb-2 text-sm font-bold text-white sm:text-base">{t("Automatic Check-in")}</h4>
              <p className="text-xs leading-5 text-emerald-200/80 sm:text-sm sm:leading-6">
                {t("Once a task is approved by the manager, your work session is recorded in attendance with the correct month, hours, and shift wage.") }
              </p>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t("Month Breakdown")} subtitle={t("Shift summary and wage totals")}>
          {summary ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <SummaryPill label={t("Morning Shifts")} value={String(summary.morning_shifts)} />
              <SummaryPill label={t("Afternoon Shifts")} value={String(summary.afternoon_shifts)} />
              <SummaryPill label={t("Evening Shifts")} value={String(summary.evening_shifts)} />
              <SummaryPill label={t("Attendance Status")} value={summary.attendance_status} />
              <SummaryPill label={t("Shift Wage Earned")} value={`Rs. ${Number(summary.shift_wage_earned).toFixed(2)}`} />
              <SummaryPill label={t("Overtime Pay")} value={`Rs. ${Number(summary.overtime_pay).toFixed(2)}`} />
              <SummaryPill label={t("Bonuses")} value={`Rs. ${Number(summary.bonus).toFixed(2)}`} />
              <SummaryPill label={t("Deductions")} value={`Rs. ${Number(summary.deductions).toFixed(2)}`} />
              <SummaryPill label={t("Gross Salary")} value={`Rs. ${Number(summary.gross_salary).toFixed(2)}`} />
              <SummaryPill label={t("Net Salary")} value={`Rs. ${Number(summary.net_salary).toFixed(2)}`} />
            </div>
          ) : (
            <p className="text-slate-500">{t("Loading summary...")}</p>
          )}
        </Card>

        <Card title={t("Worker Details")} subtitle={t("Current month attendance record")}>
          {summary ? (
            <div className="space-y-3 text-sm text-slate-300">
              <InfoRow label={t("Farmer Name")} value={summary.worker_name || displayName || t("N/A")} />
              <InfoRow label={t("Month")} value={summary.month_label} />
              <InfoRow label={t("Completed Shifts")} value={String(summary.completed_shifts)} />
              <InfoRow label={t("Equivalent Present Days")} value={Number(summary.equivalent_present_days).toFixed(2)} />
              <InfoRow label={t("Attendance Percentage")} value={`${Number(summary.attendance_percentage).toFixed(2)}%`} />
              <InfoRow label={t("Attendance Status")} value={summary.attendance_status} />
              <InfoRow label={t("Total Working Hours")} value={Number(summary.total_working_hours).toFixed(2)} />
              <InfoRow label={t("Paid Earnings")} value={`Rs. ${Number(summary.paid_salary).toFixed(2)}`} />
            </div>
          ) : (
            <div className="space-y-3 text-sm text-slate-300">
              <InfoRow label={t("Farmer Name")} value={displayName} />
              <InfoRow label={t("Month")} value={new Date().toLocaleString(undefined, { month: 'long', year: 'numeric' })} />
              <InfoRow label={t("Completed Shifts")} value="0" />
              <InfoRow label={t("Equivalent Present Days")} value="0.00" />
              <InfoRow label={t("Attendance Percentage")} value="0.00%" />
              <InfoRow label={t("Attendance Status")} value="Absent" />
              <InfoRow label={t("Total Working Hours")} value="0.00" />
              <InfoRow label={t("Paid Earnings")} value="Rs. 0.00" />
            </div>
          )}
        </Card>
      </div>

      <Card title={t("Attendance History")} subtitle={t("Your automatically tracked sessions")}>
        <div className="overflow-x-auto rounded-2xl border border-white/10 shadow-xl mt-4">
          <table className="min-w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/90 text-white font-semibold">
              <tr>
                <th className="px-6 py-4">{t("Date")}</th>
                <th className="px-6 py-4">{t("Task")}</th>
                <th className="px-6 py-4">{t("Session")}</th>
                <th className="px-6 py-4">{t("Hours")}</th>
                <th className="px-6 py-4">{t("Shift Wage Earned")}</th>
                <th className="px-6 py-4">{t("Overtime Pay")}</th>
                <th className="px-6 py-4">{t("Status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-slate-950/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-500">{t("Loading history...")}</td>
                </tr>
              ) : attendances.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                    {t("No attendance records yet. Complete and approve a task to automatically create attendance and wages.")}
                  </td>
                </tr>
              ) : (
                attendances.map((row) => (
                  <tr key={row.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 font-bold text-white flex items-center gap-2">
                      <FiCalendar className="text-slate-400" /> {new Date(row.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-emerald-400">{row.task_title || t('Task Session')}</td>
                    <td className="px-6 py-4 capitalize">{row.session || t('N/A')}</td>
                    <td className="px-6 py-4">{Number(row.total_hours || 0).toFixed(2)}</td>
                    <td className="px-6 py-4">Rs. {Number(row.shift_wage_earned ?? 0).toFixed(2)}</td>
                    <td className="px-6 py-4">Rs. {Number(row.overtime_pay ?? 0).toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                        String(row.attendance_status || '').toLowerCase() === 'present'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                      }`}>{t(row.attendance_status || 'Pending')}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function MetricCard({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-teal-500/10" />
      <div className="relative flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
          <p className="mt-3 text-2xl font-black text-slate-950">{value}</p>
        </div>
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-500">
          {icon}
        </div>
      </div>
    </Card>
  );
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-bold text-white">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-900/50 px-4 py-3">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium text-white">{value}</span>
    </div>
  );
}
