import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../../components/ui/Card';
import { getAdminSalaries } from '../../../api/admin';

interface Salary {
  id: string;
  worker_id: string;
  worker_name: string;
  payment_month: string;
  payment_status: string;
  payment_date: string | null;
  created_at: string;
  // Restated by the backend from salary_ledger so these match the manager
  // and farmer dashboards.
  earned: number;
  bonus: number;
  paid_out: number;
  deductions_total: number;
  remaining: number;
}

const money = (value: number | string | null | undefined) => `Rs. ${Number(value || 0).toFixed(2)}`;

const statusClass = (status?: string | null) => {
  const value = String(status || '').trim().toLowerCase();
  if (value === 'paid' || value === 'fully paid') return 'bg-emerald-500/15 text-emerald-300';
  if (value === 'pending') return 'bg-amber-500/15 text-amber-300';
  if (value === 'partially paid') return 'bg-sky-500/15 text-sky-300';
  return 'bg-white/10 text-slate-300';
};

export default function SalaryPaymentMonitoringPage() {
  const { t } = useTranslation();
  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSalaries();
  }, []);

  const fetchSalaries = async () => {
    try {
      setLoading(true);
      const data = await getAdminSalaries();
      setSalaries(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('Failed to load salaries data.');
    } finally {
      setLoading(false);
    }
  };

  // One box per farmer, with each of their payroll months listed inside.
  const farmers = useMemo(() => {
    const grouped = new Map<string, { name: string; rows: Salary[] }>();

    for (const row of salaries) {
      const key = row.worker_id || row.worker_name || row.id;
      const entry = grouped.get(key) || { name: row.worker_name || 'Unknown worker', rows: [] };
      entry.rows.push(row);
      grouped.set(key, entry);
    }

    return Array.from(grouped.entries()).map(([key, entry]) => ({
      key,
      name: entry.name,
      rows: entry.rows,
      totalPaid: entry.rows.reduce((sum, row) => sum + Number(row.paid_out || 0), 0),
      totalRemaining: entry.rows.reduce((sum, row) => sum + Number(row.remaining || 0), 0),
    }));
  }, [salaries]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">{t("Salary Payment Monitoring")}</h1>

      {loading ? (
        <Card variant="dark" className="border-white/10 bg-white/[0.08] backdrop-blur-2xl">
          <p className="p-4 text-slate-300">Loading salaries...</p>
        </Card>
      ) : error ? (
        <Card variant="dark" className="border-white/10 bg-white/[0.08] backdrop-blur-2xl">
          <p className="p-4 text-rose-400">{error}</p>
        </Card>
      ) : farmers.length === 0 ? (
        <Card variant="dark" className="border-white/10 bg-white/[0.08] backdrop-blur-2xl">
          <p className="p-4 text-slate-300">No salaries found.</p>
        </Card>
      ) : (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(340px,1fr))]">
          {farmers.map((farmer) => (
            <Card key={farmer.key} variant="dark" className="border-white/10 bg-white/[0.08] backdrop-blur-2xl">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
                  <div className="min-w-0">
                    <p className="truncate text-base font-bold text-white">{farmer.name}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {farmer.rows.length} {farmer.rows.length === 1 ? 'payroll month' : 'payroll months'}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{t("Remaining")}</p>
                    <p className="text-lg font-bold tabular-nums text-white">{money(farmer.totalRemaining)}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {farmer.rows.map((row) => (
                    <div key={row.id} className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-white">{row.payment_month}</span>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize leading-5 ${statusClass(row.payment_status)}`}>
                          {row.payment_status}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div className="rounded-lg bg-white/5 px-3 py-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{t("Paid out")}</p>
                          <p className="mt-0.5 text-sm font-bold tabular-nums text-emerald-300">{money(row.paid_out)}</p>
                        </div>
                        <div className="rounded-lg bg-white/5 px-3 py-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{t("Remaining")}</p>
                          <p className="mt-0.5 text-sm font-bold tabular-nums text-white">{money(row.remaining)}</p>
                        </div>
                      </div>

                      <p className="mt-3 text-xs text-slate-400">
                        Earned: {money(row.earned)} · Bonus: {money(row.bonus)} · Deductions: {money(row.deductions_total)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {row.payment_date ? new Date(row.payment_date).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
