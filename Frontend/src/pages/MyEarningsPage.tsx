import { useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { SectionHeading } from '../components/ui/SectionHeading';
import { FiCheckCircle, FiClock, FiDollarSign } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';

interface Payment {
  id: string;
  payment_month: string;
  final_payment_amount: number;
  payment_status: string;
  payment_date: string;
}

interface Summary {
  paid_salary: string;
}

export default function MyEarningsPage() {
  const { t } = useTranslation();
  const [payments, setPayments] = useState<Payment[]>([]);
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
               <div className="rounded-3xl bg-emerald-50 p-4">
                 <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600"><FiDollarSign />{t("Total Paid Earnings")}</div>
                 <p className="mt-2 text-2xl font-black text-emerald-700">Rs. {Number(summary.paid_salary).toFixed(2)}</p>
               </div>
          ) : (
            <p>{t("Loading...")}</p>
          )}
        </Card>
      </div>

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
                    <td className="px-4 py-3 font-medium text-slate-900">Rs. {Number(item.final_payment_amount).toFixed(2)}</td>
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
