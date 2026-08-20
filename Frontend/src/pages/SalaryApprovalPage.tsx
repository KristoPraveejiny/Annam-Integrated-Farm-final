import { useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { SectionHeading } from '../components/ui/SectionHeading';
import { useTranslation } from 'react-i18next';
import { FiCheckCircle } from 'react-icons/fi';

interface PayrollRow {
  id: string;
  worker_name: string;
  payment_month: string;
  payment_status: string;
  gross_salary?: number | string | null;
  net_salary?: number | string | null;
  deductions?: number | string | null;
  advance_paid?: number | string | null;
  partial_paid?: number | string | null;
}

interface AdvanceRow {
  id: string;
  worker_name: string;
  payroll_month: string;
  amount: number | string;
  reason: string;
  status: string;
  payment_status?: string | null;
}

// Payroll stays in this list until a manager approves it. Paying an advance flips the
// status to "PARTIALLY PAID" without any approval, so that state must stay here too.
const AWAITING_APPROVAL_STATUSES = ['pending', 'partially paid'];

export default function SalaryApprovalPage() {
  const { t } = useTranslation();
  const [payrolls, setPayrolls] = useState<PayrollRow[]>([]);
  const [advances, setAdvances] = useState<AdvanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [month, setMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [year, setYear] = useState(String(new Date().getFullYear()));

  useEffect(() => {
    fetchPayrolls();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year]);

  const fetchPayrolls = async () => {
    try {
      setLoading(true);
      const tokenRaw = localStorage.getItem('token');
      const token = tokenRaw && tokenRaw.startsWith('"') ? tokenRaw.slice(1, -1) : tokenRaw;

      const headers = { Authorization: `Bearer ${token}` };
      const [res, advanceRes] = await Promise.all([
        fetch(`/api/salary?month=${Number(month)}&year=${year}&status=${encodeURIComponent(AWAITING_APPROVAL_STATUSES.join(','))}`, { headers }),
        fetch('/api/salary/advances', { headers }),
      ]);
      const advanceData = await advanceRes.json();
      setAdvances(Array.isArray(advanceData) ? advanceData.filter((item) => String(item.status || '').trim().toLowerCase() === 'pending') : []);
      const data = await res.json();
      setPayrolls(
        Array.isArray(data)
          ? data.filter((item) => AWAITING_APPROVAL_STATUSES.includes(String(item.payment_status || '').trim().toLowerCase()))
          : [],
      );
    } catch (err) {
      console.error('Failed to fetch payrolls', err);
    } finally {
      setLoading(false);
    }
  };

  const reviewAdvance = async (id: string, action: 'Approve' | 'Reject') => {
    const tokenRaw = localStorage.getItem('token');
    const token = tokenRaw && tokenRaw.startsWith('"') ? tokenRaw.slice(1, -1) : tokenRaw;
    await fetch(`/api/salary/advances/${id}/review`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, notes: action === 'Approve' ? 'Approved - Payment Pending' : 'Rejected by manager' }),
    });
    setAdvances((prev) => prev.filter((item) => item.id !== id));
  };

  const approvePayroll = async (id: string) => {
    const tokenRaw = localStorage.getItem('token');
    const token = tokenRaw && tokenRaw.startsWith('"') ? tokenRaw.slice(1, -1) : tokenRaw;

    await fetch(`/api/salary/${id}/approve`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` }
    });
    setPayrolls((prev) => prev.filter((p) => p.id !== id));
  };

  const generatePendingPayroll = async () => {
    try {
      setGenerating(true);
      const tokenRaw = localStorage.getItem('token');
      const token = tokenRaw && tokenRaw.startsWith('"') ? tokenRaw.slice(1, -1) : tokenRaw;
      const res = await fetch('/api/salary/generate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: Number(month), year: Number(year) }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to generate payroll');
      await fetchPayrolls();
    } catch (err) {
      console.error('Failed to generate pending payroll:', err);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="section-shell space-y-6 py-10">
      <SectionHeading
        eyebrow={t("Manager")}
        title={t("Salary Approval")}
        description={t("Approve payroll after attendance is finalized.")}
        tone="light"
      />

      <Card title={t("Payroll Period")} subtitle={t("Choose the month to review")}>
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-full max-w-xs"><Field label={t("Month")} value={month} onChange={(e) => setMonth(e.target.value)} type="number" min="1" max="12" /></div>
          <div className="w-full max-w-xs"><Field label={t("Year")} value={year} onChange={(e) => setYear(e.target.value)} type="number" /></div>
          <button onClick={generatePendingPayroll} disabled={generating} className="h-12 rounded-2xl bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">
            {generating ? 'Generating...' : 'Generate Pending Payroll'}
          </button>
        </div>
      </Card>

      <Card title="Monthly Salary Waiting for Approval" subtitle="Review monthly payroll and approve the net salary before payment">
        {loading ? (
          <p className="text-slate-500">{t("Loading...")}</p>
        ) : payrolls.length === 0 ? (
          <p className="text-slate-500">No monthly salaries waiting for approval.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3">{t("Worker")}</th>
                  <th className="px-4 py-3">{t("Month")}</th>
                  <th className="px-4 py-3">{t("Deductions")}</th>
                  <th className="px-4 py-3">{t("Net Salary")}</th>
                  <th className="px-4 py-3">{t("Status")}</th>
                  <th className="px-4 py-3">{t("Action")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {payrolls.map((item) => {
                  // Match the worker's earnings page: advances and partial payments already
                  // taken this month are deductions against the net salary.
                  const earned = Number(item.net_salary ?? item.gross_salary ?? 0);
                  const deductions = Number(item.deductions || 0) + Number(item.advance_paid || 0) + Number(item.partial_paid || 0);
                  const net = Math.max(0, earned - deductions);

                  return (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{item.worker_name}</td>
                    <td className="px-4 py-3 text-slate-600">{item.payment_month}</td>
                    <td className="px-4 py-3 text-rose-600">- Rs. {deductions.toFixed(2)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">Rs. {net.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                        <FiCheckCircle /> {item.payment_status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => approvePayroll(item.id)}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        {t("Approve")}
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Pending Salary Advances" subtitle="Advance requests awaiting manager approval">
        {advances.length === 0 ? (
          <p className="text-slate-500">No pending salary advances for this period.</p>
        ) : (
          <div className="space-y-3">
            {advances.map((item) => (
              <div key={item.id} className="grid gap-4 rounded-2xl border border-slate-100 bg-white p-4 md:grid-cols-[1.2fr_1fr_auto_auto] md:items-center">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{item.worker_name}</p>
                  <p className="truncate text-sm text-slate-500">{item.reason}</p>
                </div>
                <div className="text-sm text-slate-500">
                  <span className="block text-xs uppercase tracking-wide text-slate-400">Payroll month</span>
                  <strong className="text-slate-900">{item.payroll_month}</strong>
                </div>
                <div className="text-left md:text-right">
                  <span className="block text-xs uppercase tracking-wide text-slate-400">Requested amount</span>
                  <strong className="text-slate-900">Rs. {Number(item.amount).toFixed(2)}</strong>
                </div>
                <div className="flex gap-2 md:justify-end">
                  <button onClick={() => reviewAdvance(item.id, 'Approve')} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700">Approve</button>
                  <button onClick={() => reviewAdvance(item.id, 'Reject')} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700">Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, className, ...rest } = props;
  return (
    <label className="space-y-2">
      <span className="text-sm font-semibold text-slate-500">{label}</span>
      <input {...rest} className={`w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-emerald-500 ${className || ''}`} />
    </label>
  );
}
