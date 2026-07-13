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
}

export default function SalaryApprovalPage() {
  const { t } = useTranslation();
  const [payrolls, setPayrolls] = useState<PayrollRow[]>([]);
  const [loading, setLoading] = useState(true);
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

      const res = await fetch(`/api/salary?month=${Number(month)}&year=${year}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setPayrolls(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch payrolls', err);
    } finally {
      setLoading(false);
    }
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

  return (
    <div className="section-shell py-10">
      <SectionHeading
        eyebrow={t("Manager")}
        title={t("Salary Approval")}
        description={t("Approve payroll after attendance is finalized.")}
        tone="light"
      />

      <Card title={t("Payroll Period")} subtitle={t("Choose the month to review")}>
        <div className="grid gap-4 md:grid-cols-2 max-w-xl">
          <Field label={t("Month")} value={month} onChange={(e) => setMonth(e.target.value)} type="number" min="1" max="12" />
          <Field label={t("Year")} value={year} onChange={(e) => setYear(e.target.value)} type="number" />
        </div>
      </Card>

      <Card title={t("Pending Approvals")} subtitle={t("Payroll records awaiting manager approval")}>
        {loading ? (
          <p className="text-slate-500">{t("Loading...")}</p>
        ) : payrolls.length === 0 ? (
          <p className="text-slate-500">{t("No payroll records for this period.")}</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3">{t("Worker")}</th>
                  <th className="px-4 py-3">{t("Month")}</th>
                  <th className="px-4 py-3">{t("Gross Salary")}</th>
                  <th className="px-4 py-3">{t("Net Salary")}</th>
                  <th className="px-4 py-3">{t("Status")}</th>
                  <th className="px-4 py-3">{t("Action")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {payrolls.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{item.worker_name}</td>
                    <td className="px-4 py-3 text-slate-600">{item.payment_month}</td>
                    <td className="px-4 py-3 text-slate-600">Rs. {Number(item.gross_salary || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-slate-600">Rs. {Number(item.net_salary || 0).toFixed(2)}</td>
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
                ))}
              </tbody>
            </table>
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
