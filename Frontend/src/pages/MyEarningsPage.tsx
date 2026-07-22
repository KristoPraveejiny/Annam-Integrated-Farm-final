import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Card } from '../components/ui/Card';
import { SectionHeading } from '../components/ui/SectionHeading';
import { FiCheckCircle, FiClock, FiDollarSign, FiActivity } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';

interface Payment {
  id: string;
  payment_month: string;
  final_payment_amount: number;
  net_salary?: number;
  payment_status: string;
  payment_date: string;
}

interface Summary {
  completed_shifts: number;
  equivalent_present_days: number;
  attendance_percentage: number;
  attendance_status: string;
  paid_salary: string;
  shift_wage_earned: number;
  overtime_pay: number;
  bonus: number;
  deductions: number;
  gross_salary: number;
  net_salary: number;
  morning_shifts: number;
  afternoon_shifts: number;
  evening_shifts: number;
  total_working_hours: number;
  ledger_earnings: number;
}

interface LedgerEntry {
  id: string;
  date: string;
  task_title: string;
  approved_progress: number;
  amount: string;
  status: string;
}

export default function MyEarningsPage() {
  const { t } = useTranslation();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEarnings = async () => {
      try {
        setLoading(true);
        const tokenRaw = localStorage.getItem('token');
        const token = tokenRaw && tokenRaw.startsWith('"') ? tokenRaw.slice(1, -1) : tokenRaw;
        
        const res = await fetch('/api/salary/my-earnings', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        setPayments(data.payments || []);
        setLedger(data.ledger || []);
        setSummary(data.summary || null);
      } catch (err) {
        console.error('Failed to fetch earnings', err);
      } finally {
        setLoading(false);
      }
    };
    fetchEarnings();
  }, []);

  return (
    <div className="section-shell py-10">
      <SectionHeading 
        eyebrow={t("Worker")} 
        title={t("My Earnings")} 
        description={t("View your completed tasks and earned salary.")} 
        tone="light" 
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr] mb-6">
        <Card title={t("Earnings Summary")} subtitle={t("Your current balances")}>
          {summary ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <SummaryStat label={t("Completed Shifts")} value={String(summary.completed_shifts ?? 0)} icon={<FiActivity />} />
              <SummaryStat label={t("Equivalent Present Days")} value={Number(summary.equivalent_present_days ?? 0).toFixed(2)} icon={<FiCheckCircle />} />
              <SummaryStat label={t("Attendance Percentage")} value={`${Number(summary.attendance_percentage ?? 0).toFixed(2)}%`} icon={<FiClock />} />
              <SummaryStat label={t("Attendance Status")} value={summary.attendance_status || t("N/A")} icon={<FiDollarSign />} />
            </div>
          ) : (
            <p>{t("Loading...")}</p>
          )}
        </Card>

        <Card title={t("Salary Breakdown")} subtitle={t("Shift wage and monthly adjustments")}>
          {summary ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <BreakdownStat label={t("Shift Wage Earned")} value={`Rs. ${Number(summary.shift_wage_earned ?? 0).toFixed(2)}`} />
              <BreakdownStat label={t("Overtime Pay")} value={`Rs. ${Number(summary.overtime_pay ?? 0).toFixed(2)}`} />
              <BreakdownStat label={t("Task Ledger Earnings")} value={`Rs. ${Number(summary.ledger_earnings ?? 0).toFixed(2)}`} />
              <BreakdownStat label={t("Bonuses")} value={`Rs. ${Number(summary.bonus ?? 0).toFixed(2)}`} />
              <BreakdownStat label={t("Deductions")} value={`Rs. ${Number(summary.deductions ?? 0).toFixed(2)}`} />
              <BreakdownStat label={t("Gross Salary")} value={`Rs. ${Number(summary.gross_salary ?? 0).toFixed(2)}`} />
              <BreakdownStat label={t("Net Salary")} value={`Rs. ${Number(summary.net_salary ?? 0).toFixed(2)}`} />
            </div>
          ) : (
            <p>{t("Loading...")}</p>
          )}
        </Card>
      </div>

      <Card title={t("Dynamic Task Ledger")} subtitle={t("Approved task updates")} className="mb-6">
        {loading ? (
          <p className="text-slate-500">{t("Loading...")}</p>
        ) : ledger.length === 0 ? (
          <p className="text-slate-500">{t("No approved tasks yet.")}</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3">{t("Date")}</th>
                  <th className="px-4 py-3">{t("Task")}</th>
                  <th className="px-4 py-3">{t("Progress")}</th>
                  <th className="px-4 py-3">{t("Amount")}</th>
                  <th className="px-4 py-3">{t("Status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {ledger.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 text-slate-600">{new Date(item.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{item.task_title}</td>
                    <td className="px-4 py-3 text-emerald-600 font-bold">+{item.approved_progress}%</td>
                    <td className="px-4 py-3 font-medium text-slate-900">Rs. {Number(item.amount).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className="capitalize font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full text-xs">
                        {t(item.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title={t("Payment History")} subtitle={t("Your monthly salary payments")}>
        {loading ? (
          <p className="text-slate-500">{t("Loading...")}</p>
        ) : payments.length === 0 ? (
          <p className="text-slate-500">{t("No payments yet.")}</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3">{t("Month")}</th>
                  <th className="px-4 py-3">{t("Amount")}</th>
                  <th className="px-4 py-3">{t("Payment Date")}</th>
                  <th className="px-4 py-3">{t("Status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {payments.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{item.payment_month}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">Rs. {Number(item.final_payment_amount ?? item.net_salary ?? 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-slate-600">{new Date(item.payment_date).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <span className={`capitalize font-medium ${item.payment_status.toLowerCase() === 'paid' ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {t(item.payment_status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function SummaryStat({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-xl font-black text-emerald-800">{value}</p>
    </div>
  );
}

function BreakdownStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-bold text-slate-900">{value}</p>
    </div>
  );
}
