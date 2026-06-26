import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../../components/ui/Card';
import { getAdminSalaries } from '../../../api/admin';

interface Salary {
  id: string;
  worker_name: string;
  payment_month: string;
  basic_salary: string;
  bonus: string;
  deductions: string;
  final_payment_amount: string;
  payment_status: string;
  payment_date: string;
  created_at: string;
}

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
      setSalaries(data);
    } catch (err) {
      setError('Failed to load salaries data.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">{t("Salary Payment Monitoring")}</h1>
      <Card variant="dark" className="border-white/10 bg-white/[0.08] backdrop-blur-2xl">
        {loading ? (
          <p className="p-4 text-slate-300">Loading salaries...</p>
        ) : error ? (
          <p className="p-4 text-rose-400">{error}</p>
        ) : salaries.length === 0 ? (
          <p className="p-4 text-slate-300">No salaries found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-slate-950/80">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">{t("Worker & Farm")}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">{t("Month")}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">{t("Amount")}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">{t("Status")}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">{t("Date")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-slate-950/30">
                {salaries.map((salary) => (
                  <tr key={salary.id} className="hover:bg-white/5">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-white">{salary.worker_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                      {salary.payment_month}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                      <div><span className="font-medium text-white">${parseFloat(salary.final_payment_amount).toFixed(2)}</span></div>
                      <div className="text-xs text-slate-400">
                        (Base: ${parseFloat(salary.basic_salary).toFixed(2)}, Bonus: ${parseFloat(salary.bonus).toFixed(2)}, Ded: ${parseFloat(salary.deductions).toFixed(2)})
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full capitalize ${
                        salary.payment_status.toLowerCase() === 'paid' ? 'bg-emerald-500/15 text-emerald-300' :
                        salary.payment_status.toLowerCase() === 'pending' ? 'bg-amber-500/15 text-amber-300' :
                        'bg-white/10 text-slate-300'
                      }`}>
                        {salary.payment_status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                      {salary.payment_date ? new Date(salary.payment_date).toLocaleDateString() : 'N/A'}
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
