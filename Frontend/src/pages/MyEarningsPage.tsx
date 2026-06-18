import { useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { SectionHeading } from '../components/ui/SectionHeading';
import { FiCheckCircle, FiClock, FiDollarSign } from 'react-icons/fi';

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
        eyebrow="Worker" 
        title="My Earnings" 
        description="View your completed tasks and earned salary." 
        tone="light" 
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr] mb-6">
        <Card title="Earnings Summary" subtitle="Your current balances">
          {summary ? (
               <div className="rounded-3xl bg-emerald-50 p-4">
                 <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600"><FiDollarSign />Total Paid Earnings</div>
                 <p className="mt-2 text-2xl font-black text-emerald-700">Rs. {Number(summary.paid_salary).toFixed(2)}</p>
               </div>
          ) : (
            <p>Loading...</p>
          )}
        </Card>
      </div>

      <Card title="Payment History" subtitle="Your monthly salary payments">
        {loading ? (
          <p className="text-slate-500">Loading...</p>
        ) : payments.length === 0 ? (
          <p className="text-slate-500">No payments yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3">Month</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Payment Date</th>
                  <th className="px-4 py-3">Status</th>
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
                        {item.payment_status}
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
